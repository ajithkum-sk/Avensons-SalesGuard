import UserMenu from "../../components/UserMenu.jsx";

export default function ComingSoon({ role }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative">
      <div className="absolute top-6 right-6">
        <UserMenu />
      </div>
      <div className="max-w-md text-center border border-line rounded bg-card p-10">
        <h1 className="text-lg font-semibold text-ink mb-2">{role} dashboard is coming soon</h1>
        <p className="text-ink-soft text-sm mb-6">
          Working on it.
        </p>
      </div>
    </div>
  );
}