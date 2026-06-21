import { LiveBoard } from "@/components/live/LiveBoard";

export const metadata = {
  title: "Draft Assistant",
};

export default function LiveDraftPage() {
  return (
    <div className="h-screen bg-[#0a0a14] text-white overflow-hidden">
      <LiveBoard />
    </div>
  );
}
