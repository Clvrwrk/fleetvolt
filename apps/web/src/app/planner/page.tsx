import { ChatPanel } from "@/components/planner/chat-panel";

export default function PlannerPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        <ChatPanel defaultRole="caas" />
      </div>
    </div>
  );
}
