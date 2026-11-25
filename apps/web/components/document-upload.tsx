"use client";

import { useState } from "react";
import { httpAdapter, UploadError } from "@uploadcn/core";
import { useUploadItem } from "@uploadcn/react";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@workspace/ui/components/ui/cubby-ui/progress/progress";
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
} from "@workspace/ui/components/upload";
import type { UploadStatus } from "@uploadcn/core";

// Extensions only: MIME tokens would be echoed verbatim in the rejection message.
const ACCEPT = [".pdf", ".docx"];
const MAX_SIZE = 25 * 1024 * 1024;

interface IngestResult {
  runId: string;
}

export type DocumentKind = "invoice" | "purchase_order";

// Posts the file to the ingest route, which starts the Trigger.dev run for
// that kind of document. Module-level so each adapter keeps a stable identity.
const adapter = (kind: DocumentKind) =>
  httpAdapter<IngestResult>({ url: "/upload/ingest", fields: { kind } });

const ADAPTERS: Record<DocumentKind, ReturnType<typeof adapter>> = {
  invoice: adapter("invoice"),
  purchase_order: adapter("purchase_order"),
};

const POLL_INTERVAL_MS = 1500;

/**
Polls the run until it finishes, then returns its output.
*/
async function waitForRun(runId: string, signal: AbortSignal) {
  for (;;) {
    interface RunState {
      status: string;
      stage: string | null;
      done: boolean;
      output: unknown;
      error: string | null;
    }
    const response = await fetch(`/upload/ingest/${runId}`, { signal });
    if (!response.ok) {
      throw new UploadError("Could not read the processing status", {
        code: "http",
      });
    }
    const run = (await response.json()) as RunState;
    if (run.done) {
      if (run.error) {
        throw new UploadError(run.error, { code: "http" });
      }
      return run.output;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    signal.throwIfAborted();
  }
}

interface ProgressState {
  label: string;
  color: "primary" | "success" | "warning" | "danger";
  /**
  Indeterminate: the bar animates without a known end.
  */
  indeterminate?: boolean;
}

const PROGRESS: Partial<Record<UploadStatus, ProgressState>> = {
  validating: {
    label: "Checking file…",
    color: "primary",
    indeterminate: true,
  },
  queued: { label: "Queued", color: "primary", indeterminate: true },
  uploading: { label: "Uploading", color: "primary" },
  paused: { label: "Paused", color: "warning" },
  processing: { label: "Processing…", color: "primary", indeterminate: true },
  scanning: { label: "Scanning…", color: "primary", indeterminate: true },
  success: { label: "Processed", color: "success" },
  error: { label: "Failed", color: "danger" },
};

function ItemProgress() {
  const item = useUploadItem();
  const state = PROGRESS[item.status];
  if (!state) {
    return null;
  }

  const value = item.status === "success" ? 100 : item.progress.percent;

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
  );
}

/**
A PDF/DOCX dropzone with a per-file upload and processing progress bar.
*/
export function DocumentUpload({
  kind,
  title,
  maxFiles,
  className,
}: {
  /**
  Decides which ingestion task processes the uploads.
  */
  readonly kind: DocumentKind;
  readonly title: string;
  readonly maxFiles?: number;
  readonly className?: string;
}) {
  interface IngestResponse {
    fileName: string;
    runId: string;
    output: unknown;
  }
  const [responses, setResponses] = useState<IngestResponse[]>([]);

  return (
    <>
      <Upload
        adapter={ADAPTERS[kind]}
        accept={ACCEPT}
        maxSize={MAX_SIZE}
        maxFiles={maxFiles}
        process={async (item, { setStatus, signal, result }) => {
          setStatus("processing");
          const output = await waitForRun(result.runId, signal);
          setResponses((current) => [
            { fileName: item.name, runId: result.runId, output },
            ...current,
          ]);
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
      {responses.map((response) => (
        <section key={response.runId} className="mt-6">
          <h2 className="text-sm font-medium">{response.fileName}</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {response.runId}
          </p>
          <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs">
            {JSON.stringify(response.output, null, 2)}
          </pre>
        </section>
      ))}
    </>
  );
}
