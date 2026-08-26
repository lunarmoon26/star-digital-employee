import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

const chartRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'charts',
  'employee-harness',
)

describe('employee-harness chart source', () => {
  it('declares the pinned-image and resource value contract', async () => {
    const chart = parse(await readFile(join(chartRoot, 'Chart.yaml'), 'utf8')) as Record<
      string,
      unknown
    >
    expect(chart.apiVersion).toBe('v2')
    expect(chart.name).toBe('employee-harness')
    const values = parse(await readFile(join(chartRoot, 'values.yaml'), 'utf8')) as {
      employeeName: string
      image: { digest: string; pullPolicy: string }
      runtime: { controlPod: { cpu: string; memory: string } }
      web: { port: number }
    }
    expect(values.employeeName).toMatch(/^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
    // Digest, when supplied, must be the employee image's own manifest digest;
    // the build-time base stays pinned by the capability lock.
    if (values.image.digest !== '') {
      expect(values.image.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
    expect(values.image.pullPolicy).toBe('Always')
    expect(values.runtime.controlPod.cpu).toBeTruthy()
    expect(values.runtime.controlPod.memory).toMatch(/^[1-9][0-9]*(?:Ki|Mi|Gi|Ti)$/)
    expect(values.web.port).toBe(3080)
  })

  it('encodes the verified container hardening in the deployment template', async () => {
    const deployment = await readFile(join(chartRoot, 'templates/deployment.yaml'), 'utf8')
    expect(deployment).toContain('replicas: 1')
    expect(deployment).toContain('type: Recreate')
    expect(deployment).toContain('automountServiceAccountToken: false')
    expect(deployment).toContain('runAsNonRoot: true')
    expect(deployment).toContain('allowPrivilegeEscalation: false')
    expect(deployment).toContain('readOnlyRootFilesystem: true')
    expect(deployment).toContain('privileged: false')
    expect(deployment).toContain('- ALL')
    // Temporary storage must permit execution: pinned DSH materializes native
    // bindings into $TMPDIR before dlopen.
    expect(deployment).toContain('medium: Memory')
    expect(deployment).toContain('/tmp')
    // Probes must be exec-based against loopback: pinned DSH binds 127.0.0.1
    // only and rejects --host 0.0.0.0 by design.
    expect(deployment).toContain('exec:')
    expect(deployment).not.toContain('httpGet:')
    expect(deployment).toContain("fetch('http://127.0.0.1:")
    const imageLine = /image: "\{\{[^}]+}}:\{\{[^}]+}}\{\{- if \.Values\.image\.digest \}\}@{{[^}]+}}{{- end }}"/.exec(
      deployment,
    )
    expect(imageLine).not.toBeNull()
  })

  it('denies ingress and egress by default in the network policy template', async () => {
    const policy = await readFile(join(chartRoot, 'templates/networkpolicy.yaml'), 'utf8')
    expect(policy).toContain('policyTypes:')
    expect(policy).toContain('- Ingress')
    expect(policy).toContain('- Egress')
    expect(policy.indexOf('podSelector')).toBeLessThan(policy.indexOf('policyTypes:'))
  })

  it('keeps the web surface ClusterIP-only and state on dedicated claims', async () => {
    const service = await readFile(join(chartRoot, 'templates/service.yaml'), 'utf8')
    expect(service).toContain('type: ClusterIP')
    const pvc = await readFile(join(chartRoot, 'templates/pvc.yaml'), 'utf8')
    expect(pvc.match(/kind: PersistentVolumeClaim/g)).toHaveLength(2)
    expect(pvc).toContain('-dsh-home')
    expect(pvc).toContain('-workspace')
    const account = await readFile(join(chartRoot, 'templates/serviceaccount.yaml'), 'utf8')
    expect(account).toContain('automountServiceAccountToken: false')
  })

  it('bounds the namespace with a quota and container defaults', async () => {
    const values = parse(
      await readFile(join(chartRoot, 'values.yaml'), 'utf8'),
    ) as {
      namespaceQuota: Record<string, string | boolean>
      runtime: { controlPod: { cpu: string; memory: string } }
    }
    expect(values.namespaceQuota.enabled).toBe(true)

    const quota = await readFile(join(chartRoot, 'templates/quota.yaml'), 'utf8')
    expect(quota).toContain('kind: ResourceQuota')
    for (const key of [
      'requests.cpu',
      'requests.memory',
      'limits.cpu',
      'limits.memory',
      'persistentvolumeclaims',
      'requests.storage',
      'pods',
    ]) {
      expect(quota).toContain(`${key}:`)
    }
    // Quota is namespace-scoped; the one-employee-per-namespace assumption must
    // stay documented next to the resource.
    expect(quota).toContain('one employee per namespace')

    const limitRange = await readFile(join(chartRoot, 'templates/limitrange.yaml'), 'utf8')
    expect(limitRange).toContain('kind: LimitRange')
    expect(limitRange).toContain('type: Container')
    expect(limitRange).toContain('default:')
    expect(limitRange).toContain('defaultRequest:')
  })

  it('encodes the authentication-proxy sidecar contract behind the loopback web surface', async () => {
    const deployment = await readFile(join(chartRoot, 'templates/deployment.yaml'), 'utf8')
    // The sidecar is a second container in the same pod (shared network
    // namespace) and forwards to the Harness loopback bind.
    expect(deployment).toContain('- name: web-proxy')
    expect(deployment).toContain('name: proxy')
    expect(deployment).toContain('name: STAR_UPSTREAM')
    expect(deployment).toContain('http://127.0.0.1:{{ .Values.web.port }}')
    expect(deployment).toContain('readOnlyRootFilesystem: true')
    expect(deployment).toContain('drop:')
    expect(deployment).toContain('- ALL')

    const service = await readFile(join(chartRoot, 'templates/service.yaml'), 'utf8')
    // The proxy is the only published port; the Harness web port stays inside
    // the pod. Both branches are expressed so the render stays valid.
    expect(service).toContain('name: proxy')
    expect(service).toContain('targetPort: proxy')
    expect(service).toContain('targetPort: web')

    const values = parse(await readFile(join(chartRoot, 'values.yaml'), 'utf8')) as {
      webProxy: { enabled: boolean; port: number; image: { repository: string } }
    }
    // Disabled by default so the existing loopback-only conformance run still
    // applies without pulling a proxy image; production enables it.
    expect(values.webProxy.enabled).toBe(false)
    expect(values.webProxy.port).toBe(4180)
    expect(values.webProxy.image.repository).toContain('oauth2-proxy')
  })
})
