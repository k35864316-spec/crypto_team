import { Suspense } from "react";
import DownloadView from "@/components/DownloadView";

export default function DownloadPage() {
  return (
    <Suspense>
      <DownloadView />
    </Suspense>
  );
}
