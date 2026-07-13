import { Suspense } from "react";
import InternDashboard from "@/components/intern-dashboard";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <InternDashboard />
    </Suspense>
  );
}
