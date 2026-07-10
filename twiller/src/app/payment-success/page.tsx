import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PaymentSuccessContent from "./PaymentSuccessContent";

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}