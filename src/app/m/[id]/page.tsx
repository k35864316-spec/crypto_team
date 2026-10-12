import { Suspense } from "react";
import ManageView from "@/components/ManageView";

export default function ManagePage() {
  return (
    <Suspense>
      <ManageView />
    </Suspense>
  );
}
