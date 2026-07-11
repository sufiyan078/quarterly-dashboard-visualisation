import PreReportPage from "./page.client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <PreReportPage />;
}
