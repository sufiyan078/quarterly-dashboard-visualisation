"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function useReportId(): string {
  const params = useParams();
  const [reportId, setReportId] = useState<string>((params?.id as string) || "placeholder");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pathParts = window.location.pathname.split("/");
      const reportsIndex = pathParts.indexOf("reports");
      if (reportsIndex !== -1 && pathParts[reportsIndex + 1]) {
        const id = pathParts[reportsIndex + 1];
        if (id && id !== "placeholder") {
          setReportId(id);
        }
      }
    }
  }, [params]);

  return reportId;
}
