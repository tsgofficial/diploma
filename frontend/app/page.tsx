import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">University Policy Assistant</h1>
      <p className="max-w-md text-gray-600">
        Ask questions about school policies, rules, and documents — answered only
        from official sources.
      </p>
      <Link
        href="/chat"
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Start chatting
      </Link>
    </main>
  );
}
