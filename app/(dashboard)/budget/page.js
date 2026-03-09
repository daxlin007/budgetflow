"use client";

export default function BudgetPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="text-4xl mb-4">💬</div>
        <h2 className="text-xl font-bold mb-2">Budget & Chat</h2>
        <p className="text-bf-dim text-sm">
          The chat interface from the prototype goes here.<br />
          Same architecture — calls /api/parse-spending instead of Anthropic directly.
        </p>
      </div>
    </div>
  );
}
