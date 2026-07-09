import { DashboardShell } from "@/components/DashboardShell";
import { RegisterProvider } from "@/context/RegisterContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1c] font-sans selection:bg-blue-500/30 overflow-hidden relative">
      {/* Global Background decorative blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen pointer-events-none" />

      <RegisterProvider>
        <DashboardShell>{children}</DashboardShell>
      </RegisterProvider>
    </div>
  );
}

