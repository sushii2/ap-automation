"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessagesSquare } from "lucide-react";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Which invoices need review?",
  "Show invoices without a matching PO",
  "What did we spend with Northwind this month?",
  "Summarize last week's invoices",
];

// TODO: replace with `useChat` from the AI SDK once the invoice index and a
// chat route exist. Until then every question gets this fixed reply.
const NOT_CONNECTED =
  "Chat isn't connected to your invoices yet. Once invoices are indexed, answers will show up here.";

export function InvoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(replyTimer.current), []);

  const canSend = text.trim().length > 0 && !busy;

  function send(prompt: string) {
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: prompt },
    ]);
    setText("");
    setBusy(true);
    replyTimer.current = setTimeout(() => {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: NOT_CONNECTED },
      ]);
      setBusy(false);
    }, 600);
  }

  return (
    <MessageScrollerProvider autoScroll>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessagesSquare />
                </EmptyMedia>
                <EmptyTitle>Ask about your invoices</EmptyTitle>
                <EmptyDescription>
                  Look up amounts, vendors, due dates and purchase-order matches
                  in plain language.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent aria-busy={busy} className="gap-6">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor
                      >
                        <Message align="end">
                          <MessageContent>
                            <Bubble align="end" variant="muted">
                              <BubbleContent>{message.text}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                      >
                        <Message>
                          <MessageContent>
                            <p className="text-sm">{message.text}</p>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )
                  )}
                  {!!busy && (
                    <p
                      role="status"
                      className="animate-pulse text-sm text-muted-foreground"
                    >
                      Thinking…
                    </p>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault();
              if (canSend) {
                send(text.trim());
              }
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ask about your invoices…"
                aria-label="Message"
                className="min-h-14"
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
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </MessageScrollerProvider>
  );
}
