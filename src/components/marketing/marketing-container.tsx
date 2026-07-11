import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type MarketingContainerProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function MarketingContainer<T extends ElementType = "div">({
  as,
  children,
  className = "",
  ...props
}: MarketingContainerProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={`marketing-container ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}
