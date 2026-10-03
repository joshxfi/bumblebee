import {
  ArrowClockwiseIcon,
  CheckIcon,
  CopySimpleIcon,
} from "@phosphor-icons/react";

import { ChatReasoning } from "@/components/chat/chat-reasoning";
import { formatTimestamp } from "@/components/chat/chat-ui";
import { MarkdownMessage } from "@/components/markdown-message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import type { ChatMessage } from "@/lib/chat-types";

type ChatMessageBubbleProps = {
  canContinue: boolean;
  copyState: "copied" | "error" | null;
  message: ChatMessage;
  onContinue: () => void;
  onCopy: (message: ChatMessage) => void;
};

export function ChatMessageBubble({
  canContinue,
  copyState,
  message,
  onContinue,
  onCopy,
}: ChatMessageBubbleProps) {
  const assistant = message.role === "assistant";
  const streaming = message.state === "streaming";
  const hasAnswer = message.content.trim().length > 0;
  const reasoning = assistant ? (message.reasoning?.trim() ?? "") : "";
  const isReasoning = streaming && reasoning.length > 0 && !hasAnswer;
  const showPendingPlaceholder =
    assistant && streaming && !hasAnswer && reasoning.length === 0;
  const failedBeforeText = message.state === "error" && !hasAnswer;
  const bodyText = failedBeforeText
    ? "Response failed before any text arrived."
    : message.content;
  const canCopy = assistant && hasAnswer;
  const hitLengthLimit = assistant && message.finishReason === "length";

  return (
    <Message
      align={assistant ? "start" : "end"}
      aria-busy={assistant ? streaming : undefined}
    >
      <MessageContent className="gap-1.5">
        {reasoning ? (
          <ChatReasoning
            durationMs={message.reasoningDurationMs}
            interrupted={!streaming && !hasAnswer}
            reasoning={reasoning}
            streaming={isReasoning}
          />
        ) : null}

        {showPendingPlaceholder ? (
          <Marker role="status">
            <MarkerIcon className="animate-[bee-bob_0.95s_ease-in-out_infinite] text-sm motion-reduce:animate-none">
              🐝
            </MarkerIcon>
            <MarkerContent className="shimmer">
              Bumblebee is thinking…
            </MarkerContent>
          </Marker>
        ) : bodyText ? (
          <Bubble
            align={assistant ? "start" : "end"}
            variant={
              failedBeforeText ? "destructive" : assistant ? "ghost" : "default"
            }
          >
            <BubbleContent className="text-sm/6">
              {assistant && streaming ? (
                <div className="whitespace-pre-wrap break-words text-foreground">
                  {bodyText}
                </div>
              ) : (
                <MarkdownMessage
                  className={`bumblebee-markdown ${
                    assistant
                      ? "text-foreground"
                      : "text-primary-foreground [--link-color:var(--primary-foreground)]"
                  }`}
                  content={bodyText}
                />
              )}
            </BubbleContent>
          </Bubble>
        ) : null}

        <MessageFooter className="flex-wrap justify-between gap-x-2 gap-y-1 px-0 text-[11px] font-normal">
          <span>
            {assistant ? "Bumblebee" : "You"} ·{" "}
            {formatTimestamp(message.createdAt)}
          </span>
          {assistant ? (
            <div className="flex flex-wrap items-center gap-2">
              {hitLengthLimit ? (
                <span className="text-primary">Response paused</span>
              ) : null}
              {canContinue ? (
                <Button
                  className="border-primary/30 px-2 text-primary hover:bg-primary/10"
                  size="xs"
                  variant="outline"
                  onClick={onContinue}
                >
                  <ArrowClockwiseIcon data-icon="inline-start" />
                  Continue
                </Button>
              ) : null}
              {copyState ? (
                <span
                  className={
                    copyState === "error" ? "text-destructive" : "text-primary"
                  }
                >
                  {copyState === "copied" ? "Copied" : "Copy failed"}
                </span>
              ) : null}
              {canCopy ? (
                <Button
                  aria-label="Copy response"
                  className="px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  size="xs"
                  variant="ghost"
                  onClick={() => onCopy(message)}
                >
                  {copyState === "copied" ? <CheckIcon /> : <CopySimpleIcon />}
                </Button>
              ) : null}
            </div>
          ) : null}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
