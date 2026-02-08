export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-3 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
      {children}
    </h3>
  );
}
