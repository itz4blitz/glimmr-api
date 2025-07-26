import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/theme-provider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={{ right: "1rem", left: "auto" }}
      position="top-right"
      closeButton
      expand={true}
      duration={4000}
      offset="80px"
      toastOptions={{
        className:
          "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
        style: {
          boxShadow:
            "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)",
        },
        descriptionClassName: "group-[.toast]:text-muted-foreground",
      }}
      {...props}
    />
  );
};

export { Toaster };
