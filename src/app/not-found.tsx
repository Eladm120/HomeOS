import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="num text-5xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">העמוד לא נמצא</h1>
      <Link href="/" className="font-medium text-primary">
        חזרה לבית
      </Link>
    </div>
  );
}
