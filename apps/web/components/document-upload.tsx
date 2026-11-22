"use client"

import { mockAdapter, type UploadStatus } from "@uploadcn/core"
import { useUploadItem } from "@uploadcn/react"

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@workspace/ui/components/ui/cubby-ui/progress/progress"
import {
  Upload,
  UploadDropzone,
  UploadDropzoneDescription,
  UploadDropzoneHeader,
  UploadDropzoneMedia,
  UploadDropzoneTitle,
  UploadItem,
  UploadItemActions,
  UploadItemContent,
  UploadItemDescription,
  UploadItemMedia,
  UploadItemTitle,
  UploadList,
} from "@workspace/ui/components/upload"

// Extensions only: MIME tokens would be echoed verbatim in the rejection message.
const ACCEPT = [".pdf", ".docx"]
const MAX_SIZE = 25 * 1024 * 1024

// TODO: replace with a real storage adapter and extraction pipeline. Until
// then uploads are simulated in the browser and no file leaves the device.
const adapter = mockAdapter({ speed: 1_500_000 })

async function simulateProcessing(signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 2000)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

type ProgressState = {
  label: string
  color: "primary" | "success" | "warning" | "danger"
  /** Indeterminate: the bar animates without a known end. */
  indeterminate?: boolean
}

const PROGRESS: Partial<Record<UploadStatus, ProgressState>> = {
  validating: { label: "Checking file…", color: "primary", indeterminate: true },
  queued: { label: "Queued", color: "primary", indeterminate: true },
  uploading: { label: "Uploading", color: "primary" },
  paused: { label: "Paused", color: "warning" },
  processing: { label: "Processing…", color: "primary", indeterminate: true },
  scanning: { label: "Scanning…", color: "primary", indeterminate: true },
  success: { label: "Processed", color: "success" },
  error: { label: "Failed", color: "danger" },
}

function ItemProgress() {
  const item = useUploadItem()
  const state = PROGRESS[item.status]
  if (!state) return null

  const value = item.status === "success" ? 100 : item.progress.percent

  return (
    <ProgressRoot
      className="basis-full"
      value={state.indeterminate ? null : value}
      color={state.color}
    >
      <ProgressLabel>{state.label}</ProgressLabel>
      {!state.indeterminate && <ProgressValue />}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  )
}

/** A PDF/DOCX dropzone with a per-file upload and processing progress bar. */
export function DocumentUpload({
  title,
  maxFiles,
  className,
}: {
  title: string
  maxFiles?: number
  className?: string
}) {
  return (
    <Upload
      adapter={adapter}
      accept={ACCEPT}
      maxSize={MAX_SIZE}
      maxFiles={maxFiles}
      process={async (_item, { setStatus, signal }) => {
        setStatus("processing")
        await simulateProcessing(signal)
      }}
      className={className}
    >
      <UploadDropzone size="lg">
        <UploadDropzoneHeader>
          <UploadDropzoneMedia variant="icon" />
          <UploadDropzoneTitle>{title}</UploadDropzoneTitle>
          <UploadDropzoneDescription>
            PDF or DOCX · up to 25 MB each
          </UploadDropzoneDescription>
        </UploadDropzoneHeader>
      </UploadDropzone>
      <UploadList>
        <UploadItem>
          <UploadItemMedia />
          <UploadItemContent>
            <UploadItemTitle />
            <UploadItemDescription />
          </UploadItemContent>
          <UploadItemActions />
          <ItemProgress />
        </UploadItem>
      </UploadList>
    </Upload>
  )
}
