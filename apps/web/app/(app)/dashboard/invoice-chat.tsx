"use client";

import { useRef, useState } from "react";
import {
  ArrowUp,
  FileDown,
  MessagesSquare,
  SquarePen,
  Square,
} from "lucide-react";

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group";
import { Message, MessageContent } from "@workspace/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";

import { useInvoiceChat } from "@/hooks/use-invoice-chat";
import { isChatClosed } from "@/lib/chat/chat-state";
import { ChatMarkdown } from "./chat-markdown";
import type { ChatTurn } from "@/lib/chat/chat-state";
import type { ChatFile, TurnEndReason } from "@/lib/chat/protocol";

const SUGGESTIONS = [
  "Which invoices need review?",
  "Show invoices without a matching PO",
  "Compare each invoice with its purchase order",
  "Make a PDF report of spend by vendor",
];

// Shown under an answer that did not end normally.
const END_NOTICES: Partial<Record<TurnEndReason, string>> = {
  budget_reached:
    "This chat has reached its usage limit. Start a new chat to keep going.",
  failed: "The assistant ran into a problem and stopped. Try asking again.",
  refusal: "The assistant declined to answer that.",
  terminated: "This chat has ended. Start a new chat to continue.",
};

const BYTES_PER_KILOBYTE = 1024;

const formatSize = (bytes: number) => {
  const kilobytes = bytes / BYTES_PER_KILOBYTE;
  return kilobytes < BYTES_PER_KILOBYTE
    ? `${Math.max(1, Math.round(kilobytes))} KB`
    : `${(kilobytes / BYTES_PER_KILOBYTE).toFixed(1)} MB`;
};

function FileLinks({
  files,
  downloadUrl,
}: {
  readonly files: ChatFile[];
  readonly downloadUrl: (fileId: string) => string;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file) => (
        <li key={file.id}>
          <Button asChild variant="outline" className="h-auto gap-2 py-2">
            <a href={downloadUrl(file.id)} download={file.name}>
              <FileDown aria-hidden />
              <span className="flex flex-col items-start">
                <span>{file.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatSize(file.sizeBytes)}
                </span>
              </span>
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Turn({
  turn,
  downloadUrl,
}: {
  readonly turn: ChatTurn;
  readonly downloadUrl: (fileId: string) => string;
}) {
  const notice = turn.ended ? END_NOTICES[turn.ended] : undefined;
  const hasReply =
    turn.answers.length > 0 || turn.files.length > 0 || Boolean(notice);

  return (
    <>
      {turn.questions.map((question) => (
        <MessageScrollerItem
          key={question.id}
          messageId={question.id}
          scrollAnchor
        >
          <Message align="end">
            <MessageContent>
              <Bubble align="end" variant="muted">
                <BubbleContent>{question.text}</BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        </MessageScrollerItem>
      ))}
      {hasReply ? (
        <MessageScrollerItem messageId={`reply-${turn.turn}`}>
          <Message>
            <MessageContent>
              {turn.answers.map((answer) => (
                <ChatMarkdown key={answer.id} text={answer.text} />
              ))}
              {turn.files.length > 0 && (
                <FileLinks files={turn.files} downloadUrl={downloadUrl} />
              )}
              {notice ? (
                <p className="text-sm text-muted-foreground">{notice}</p>
              ) : null}
            </MessageContent>
          </Message>
        </MessageScrollerItem>
      ) : null}
    </>
  );
}

const EMPTY_DESCRIPTION =
  "Look up amounts, vendors, due dates and purchase-order matches, or ask for an analysis or a PDF report.";
const DISABLED_DESCRIPTION =
  "Chat isn't set up on this deployment yet. It needs an Anthropic API key and the chat agent's IDs.";

export function InvoiceChat({
  storageKey,
  isEnabled,
}: {
  /**
  Where this user's open chat is remembered in the browser.
  */
  readonly storageKey: string;
  readonly isEnabled: boolean;
}) {
  const { state, status, send, stop, reset, downloadUrl } = useInvoiceChat(
    storageKey,
    isEnabled
  );
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const isBusy = status !== "idle";
  const isClosed = isChatClosed(state);
  const isEmpty = state.turns.length === 0 && state.pending.length === 0;
  const canType = isEnabled && !isClosed;
  const canSend = canType && !isBusy && text.trim().length > 0;

  const submit = (prompt: string) => {
    setText("");
    void send(prompt);
  };

  let progress: string | null = null;
  if (status === "loading") {
    progress = "Opening your chat";
  } else if (status === "busy") {
    progress = state.activity ?? "Thinking";
  }

  return (
    <MessageScrollerProvider autoScroll>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1">
          {isEmpty && status !== "loading" ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessagesSquare />
                </EmptyMedia>
                <EmptyTitle>Ask about your invoices</EmptyTitle>
                <EmptyDescription>
                  {isEnabled ? EMPTY_DESCRIPTION : DISABLED_DESCRIPTION}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent aria-busy={isBusy} className="gap-6">
                  {state.turns.map((turn) => (
                    <Turn
                      key={turn.turn}
                      turn={turn}
                      downloadUrl={downloadUrl}
                    />
                  ))}
                  {state.pending.map((message) => (
                    <Message key={message.id} align="end">
                      <MessageContent>
                        <Bubble align="end" variant="muted">
                          <BubbleContent>{message.text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ))}
                  {progress ? (
                    <p
                      role="status"
                      className="animate-pulse text-sm text-muted-foreground"
                    >
                      {progress}…
                    </p>
                  ) : null}
                  {state.error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {state.error}
                    </p>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {isEmpty && isEnabled ? (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault();
              if (canSend) {
                submit(text.trim());
              }
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  isClosed
                    ? "Start a new chat to continue"
                    : "Ask about your invoices…"
                }
                aria-label="Message"
                className="min-h-14"
                disabled={!canType}
                onKeyDown={(event) => {
                  if (
                    event.key !== "Enter" ||
                    event.shiftKey ||
                    event.nativeEvent.isComposing
                  ) {
                    return;
                  }

                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }}
              />
              <InputGroupAddon align="block-end">
                {!isEmpty && (
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={status === "loading"}
                    onClick={reset}
                  >
                    <SquarePen aria-hidden />
                    New chat
                  </InputGroupButton>
                )}
                {status === "busy" ? (
                  <InputGroupButton
                    type="button"
                    variant="default"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label="Stop"
                    onClick={() => {
                      void stop();
                    }}
                  >
                    <Square aria-hidden className="fill-current" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    disabled={!canSend}
                    className="ml-auto"
                    aria-label="Send"
                  >
                    <ArrowUp />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </MessageScrollerProvider>
  );
}
