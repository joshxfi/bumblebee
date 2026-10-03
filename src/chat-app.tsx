import { PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { ChatPerfOverlay } from "@/components/chat/chat-perf-overlay";
import { ChatPrepareModel } from "@/components/chat/chat-prepare-model";
import { copyToClipboard, isSubmitEnter } from "@/components/chat/chat-ui";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, getModelConfig } from "@/lib/chat-config";
import { getLatestChatPerfSample, subscribeChatPerf } from "@/lib/chat-runtime";
import { CONTINUE_PROMPT, useChatStore } from "@/lib/chat-store";
import type { ChatMessage } from "@/lib/chat-types";
import {
  formatContextWindowLabel,
  getContextWindowStats,
} from "@/lib/context-compaction";

/** How long the inline "Copied"/"Copy failed" hint stays visible. */
const COPY_FEEDBACK_MS = 1800;

export function ChatApp() {
  const messages = useChatStore((state) => state.messages);
  const composer = useChatStore((state) => state.composer);
  const runtimeStatus = useChatStore((state) => state.runtimeStatus);
  const error = useChatStore((state) => state.error);
  const hasLoadedModel = useChatStore((state) => state.hasLoadedModel);
  const loadProgress = useChatStore((state) => state.loadProgress);
  const availableModels = useChatStore((state) => state.availableModels);
  const selectedModelId = useChatStore((state) => state.selectedModelId);
  const deviceProfile = useChatStore((state) => state.deviceProfile);
  const setComposer = useChatStore((state) => state.setComposer);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const continueLastResponse = useChatStore(
    (state) => state.continueLastResponse,
  );
  const initModel = useChatStore((state) => state.initModel);
  const cancelModelLoad = useChatStore((state) => state.cancelModelLoad);
  const stopGeneration = useChatStore((state) => state.stopGeneration);
  const retryLastTurn = useChatStore((state) => state.retryLastTurn);
  const clearChat = useChatStore((state) => state.clearChat);
  const dismissError = useChatStore((state) => state.dismissError);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const isCompactingContext = useChatStore(
    (state) => state.isCompactingContext,
  );
  const rollingContextSummary = useChatStore(
    (state) => state.rollingContextSummary,
  );
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const [copiedMessageState, setCopiedMessageState] = useState<{
    messageId: string;
    status: "copied" | "error";
  } | null>(null);
  const perfSample = useSyncExternalStore(
    subscribeChatPerf,
    getLatestChatPerfSample,
    () => null,
  );

  const selectedModel = getModelConfig(selectedModelId);
  const busy =
    runtimeStatus === "generating" || runtimeStatus === "loading-model";
  const canRetry =
    !busy &&
    messages.some((message) => message.role === "user") &&
    messages.at(-1)?.role !== "user";
  const canSend = composer.trim().length > 0 && !busy;
  const continuableMessageId =
    messages.at(-1)?.role === "assistant" &&
    messages.at(-1)?.finishReason === "length"
      ? (messages.at(-1)?.id ?? null)
      : null;
  const showPrepareModel = !hasLoadedModel;
  const contextWindowLabel = useMemo(() => {
    if (messages.length === 0) {
      return null;
    }
    const includeContinue = continuableMessageId !== null;
    const stats = getContextWindowStats(
      messages,
      selectedModelId,
      rollingContextSummary,
      includeContinue
        ? [{ content: CONTINUE_PROMPT, role: "user" as const }]
        : [],
    );
    return formatContextWindowLabel(stats);
  }, [continuableMessageId, messages, rollingContextSummary, selectedModelId]);
  const mascotTone = error
    ? "error"
    : runtimeStatus === "loading-model"
      ? "loading"
      : runtimeStatus === "generating"
        ? "typing"
        : runtimeStatus === "ready"
          ? "ready"
          : "idle";
  const progressMeta = !loadProgress
    ? null
    : (() => {
        const loaded = formatBytes(loadProgress.loaded);
        const total = formatBytes(loadProgress.total);

        return loaded && total ? `${loaded} / ${total}` : null;
      })();

  // The composer is a fixed overlay, so the list pads its end to clear it and
  // the jump-to-latest button floats just above it.
  const composerClearanceClassName = showPrepareModel
    ? "pb-[calc(13.5rem+env(safe-area-inset-bottom))]"
    : "pb-[calc(10.5rem+env(safe-area-inset-bottom))]";
  const scrollButtonOffsetClassName = showPrepareModel
    ? "data-[direction=end]:bottom-[calc(10rem+env(safe-area-inset-bottom))] sm:data-[direction=end]:bottom-[calc(9rem+env(safe-area-inset-bottom))]"
    : "data-[direction=end]:bottom-[calc(6.75rem+env(safe-area-inset-bottom))] sm:data-[direction=end]:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]";

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyMessage = async (message: ChatMessage) => {
    if (message.content.trim().length === 0) {
      return;
    }

    try {
      await copyToClipboard(message.content);
      setCopiedMessageState({ messageId: message.id, status: "copied" });
    } catch {
      setCopiedMessageState({ messageId: message.id, status: "error" });
    }

    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
    }

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopiedMessageState((current) =>
        current?.messageId === message.id ? null : current,
      );
    }, COPY_FEEDBACK_MS);
  };

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <ChatHeader
        availableModels={availableModels}
        canRetry={canRetry}
        mascotTone={mascotTone}
        messagesCount={messages.length}
        modelSelectionDisabled={runtimeStatus === "loading-model"}
        onClear={clearChat}
        onRetry={retryLastTurn}
        onSelectModel={setSelectedModel}
        selectedModelId={selectedModelId}
        selectedModelLabel={selectedModel.label}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col pt-16">
        {messages.length === 0 ? (
          <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 ${composerClearanceClassName}`}
          >
            <ChatEmptyState
              busy={busy}
              currentModelLabel={selectedModel.label}
              onPrompt={sendMessage}
            />
          </div>
        ) : (
          <MessageScrollerProvider autoScroll>
            <MessageScroller className="flex-1">
              <MessageScrollerViewport aria-label="Conversation">
                <MessageScrollerContent
                  className={`gap-5 px-3 pt-4 sm:px-4 ${composerClearanceClassName}`}
                >
                  {messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <ChatMessageBubble
                        canContinue={
                          !busy &&
                          continuableMessageId === message.id &&
                          message.content.trim().length > 0
                        }
                        copyState={
                          copiedMessageState?.messageId === message.id
                            ? copiedMessageState.status
                            : null
                        }
                        message={message}
                        onContinue={continueLastResponse}
                        onCopy={handleCopyMessage}
                      />
                    </MessageScrollerItem>
                  ))}
                  {isCompactingContext ? (
                    <MessageScrollerItem messageId="context-compaction">
                      <ContextCompactionMarker />
                    </MessageScrollerItem>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton
                aria-label="Scroll to latest messages"
                className={`z-20 border shadow-[0_8px_24px_rgba(0,0,0,0.22)] ${scrollButtonOffsetClassName}`}
              />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          {showPrepareModel ? (
            <ChatPrepareModel
              detail={
                loadProgress?.detail ??
                `Ready to prepare ${selectedModel.label}.`
              }
              deviceProfile={deviceProfile}
              error={error}
              modelLabel={selectedModel.label}
              onCancelModelLoad={cancelModelLoad}
              onDismissError={dismissError}
              onInitModel={initModel}
              progress={loadProgress?.progress ?? null}
              progressMeta={progressMeta}
              runtimeStatus={runtimeStatus}
            />
          ) : null}
          <div className="border border-border bg-card p-2 shadow-[0_-10px_28px_rgba(0,0,0,0.22)]">
            <form
              aria-label="Send a message to Bumblebee"
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              {hasLoadedModel && perfSample ? (
                <div className="flex h-12 shrink-0 items-center">
                  <ChatPerfOverlay
                    contextWindowLabel={contextWindowLabel}
                    sample={perfSample}
                  />
                </div>
              ) : null}
              <Textarea
                aria-label="Message Bumblebee"
                className="max-h-36 min-h-12 min-w-0 flex-1 resize-none border-border bg-transparent px-4 py-2 text-sm leading-6 focus-visible:ring-0"
                placeholder="Message Bumblebee"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (!isSubmitEnter(event.nativeEvent)) {
                    return;
                  }

                  event.preventDefault();
                  sendMessage();
                }}
              />

              <div className="flex h-12 shrink-0 items-center gap-2">
                <Button
                  className="h-12 min-h-12 w-12 min-w-12 shrink-0 rounded-none p-0 [&_svg]:size-5"
                  disabled={runtimeStatus !== "generating"}
                  size="icon"
                  type="button"
                  variant="secondary"
                  onClick={stopGeneration}
                >
                  <StopIcon />
                </Button>
                <Button
                  aria-label="Send message"
                  className="h-12 min-h-12 w-12 min-w-12 shrink-0 rounded-none p-0 [&_svg]:size-5"
                  disabled={!canSend}
                  size="icon"
                  type="submit"
                >
                  <PaperPlaneTiltIcon />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextCompactionMarker() {
  return (
    <Marker role="status" variant="separator">
      <MarkerIcon>
        <Spinner className="size-3.5" />
      </MarkerIcon>
      <MarkerContent className="shimmer">
        Updating conversation context…
      </MarkerContent>
    </Marker>
  );
}

export default ChatApp;
