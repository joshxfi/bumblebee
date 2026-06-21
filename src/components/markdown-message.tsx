import type { ComponentPropsWithoutRef } from "react";
import "streamdown/styles.css";
import {
  type Components,
  defaultUrlTransform,
  Streamdown,
  type UrlTransform,
} from "streamdown";

const safeUrlTransform: UrlTransform = (url, key, node) => {
  if (!url.startsWith("https://")) {
    return null;
  }

  return defaultUrlTransform(url, key, node);
};

const markdownComponents: Components = {
  a: ({ children, href, ...props }) => {
    if (!href?.startsWith("https://")) {
      return <span>{children}</span>;
    }

    return (
      <a
        href={href}
        rel="noreferrer noopener nofollow"
        target="_blank"
        {...props}
      >
        {children}
      </a>
    );
  },
};

type MarkdownMessageProps = {
  content: string;
  streaming?: boolean;
} & Pick<ComponentPropsWithoutRef<"div">, "className">;

export function MarkdownMessage({
  className,
  content,
  streaming = false,
}: MarkdownMessageProps) {
  return (
    <Streamdown
      className={className}
      components={markdownComponents}
      controls={false}
      disallowedElements={["img"]}
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown
      skipHtml
      urlTransform={safeUrlTransform}
    >
      {content}
    </Streamdown>
  );
}
