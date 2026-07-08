import Link from "next/link";
import { Home } from "lucide-react";
import { FramedPanel } from "@/components/design/framed-panel";
import { PrimaryButton } from "@/components/design/primary-button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--fv-bg)" }}>
      <FramedPanel className="max-w-md w-full">
        <div className="text-center space-y-4 p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--fv-accent)]/10">
            <span className="text-2xl font-bold text-[var(--fv-accent)]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              404
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--fv-text)]">Page not found</h1>
          <p className="text-sm text-[var(--fv-text-muted)]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link href="/" className="inline-block w-full">
            <PrimaryButton className="w-full">
              <Home size={16} className="mr-2" />
              Go to Home
            </PrimaryButton>
          </Link>
        </div>
      </FramedPanel>
    </div>
  );
}
