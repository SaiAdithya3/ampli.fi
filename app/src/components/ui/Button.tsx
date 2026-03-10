import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className,
  children,
  leftIcon,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2.5 rounded-amplifi transition-colors disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-amplifi-nav text-white hover:bg-amplifi-primary-hover",
    secondary:
      "border border-amplifi-border bg-amplifi-surface text-amplifi-text hover:opacity-90",
    ghost: "text-amplifi-text hover:text-amplifi-text",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-3.5 text-base",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  );
};

export default Button;
