export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-rc-bg-darkest text-rc-text">
      {children}
    </div>
  );
}
