"use client";

export default function HistoryPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="text-xl font-bold mb-2">Transaction History</h2>
        <p className="text-bf-dim text-sm">
          Month-filtered transaction list with edit/delete and CSV export.
        </p>
      </div>
    </div>
  );
}
