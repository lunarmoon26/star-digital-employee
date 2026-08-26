/**
 * Workspace broker contract (ADR 0011): a typed service boundary for leasing
 * isolated, resource-sized execution worlds. The broker owns leases and quotas;
 * DeepSeek Harness sees only a narrow filesystem/subprocess surface. None of
 * these types carry Kubernetes, cluster, or provider credentials (ADR 0006).
 */

/** A named execution profile resolved from the recipe's `spec.execution.profiles`. */
export interface ExecutionProfile {
  provider: 'local' | 'kubernetes'
  cpu: string
  memory: string
  approval?: 'none' | 'supervisor'
  idleTimeoutMinutes?: number
}

/** A lease request for one task worktree in a named profile. */
export interface LeaseRequest {
  /** Named execution profile reference. */
  profile: string
  /** Stable task identity, correlated to the supervisor task ledger. */
  taskId: string
  /** Credential-free HTTPS repository; Git remains the source of truth. */
  repository: string
  /** Optional branch or commit for the worktree. */
  branch?: string
}

export type LeaseStatus = 'provisioning' | 'ready' | 'stopped' | 'released' | 'failed'

/** One PVC-backed execution world leased by the broker. */
export interface WorkspaceLease {
  leaseId: string
  profile: string
  taskId: string
  repository: string
  branch: string | null
  /** Worktree path within the workspace; absent until the lease is ready. */
  worktree: string | null
  status: LeaseStatus
  createdAt: number
  expiresAt: number | null
}

/** Narrow, credential-free filesystem surface over one leased workspace. */
export interface RemoteFilesystem {
  read(path: string): Promise<Uint8Array>
  write(path: string, contents: Uint8Array): Promise<void>
  list(path: string): Promise<string[]>
  stat(path: string): Promise<{ kind: 'file' | 'directory'; size: number }>
  remove(path: string): Promise<void>
}

/** A spawned remote process handle; exit and signal are the only results. */
export interface RemoteProcess {
  pid: string
  kill(signal?: string): Promise<void>
  wait(): Promise<{ exitCode: number | null; signal: string | null }>
}

/** Narrow, credential-free subprocess surface over one leased workspace. */
export interface RemoteSubprocess {
  spawn(command: string, args: readonly string[], cwd: string): Promise<RemoteProcess>
}

/** The broker: owns leases, quotas, retention, and provider isolation. */
export interface WorkspaceBroker {
  lease(request: LeaseRequest): Promise<WorkspaceLease>
  resume(leaseId: string): Promise<WorkspaceLease>
  stop(leaseId: string): Promise<WorkspaceLease>
  release(leaseId: string): Promise<WorkspaceLease>
  list(): Promise<readonly WorkspaceLease[]>
  filesystem(leaseId: string): Promise<RemoteFilesystem>
  subprocess(leaseId: string): Promise<RemoteSubprocess>
}
