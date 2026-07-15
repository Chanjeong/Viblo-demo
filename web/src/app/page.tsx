import { TitleEditor } from '@/components/TitleEditor';
import { GeneralSettings } from '@/components/GeneralSettings';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 bg-gray-50 p-6">
      <TitleEditor />
      <GeneralSettings />
    </main>
  );
}
