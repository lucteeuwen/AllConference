import type { ReactNode } from "react";

type Props = {
  text: string;
  as?: "h1" | "h2" | "span";
  className?: string;
  /** Rendered after the words, e.g. a ranked tag. */
  children?: ReactNode;
};

/**
 * A title split into its first word and the rest, so a design can colour,
 * highlight or underline them separately. `data-text` feeds the decorative
 * copies some designs draw behind the title with `attr()`.
 */
export function Headline({ text, as: Tag = "h1", className = "", children }: Props) {
  const [first, ...rest] = text.split(" ");
  return (
    <Tag className={`bc-headline ${className}`} data-text={text}>
      <span className="bc-hl-first">{first}</span>
      {rest.length > 0 ? (
        <>
          {" "}
          <span className="bc-hl-rest">{rest.join(" ")}</span>
        </>
      ) : null}
      {children}
    </Tag>
  );
}
