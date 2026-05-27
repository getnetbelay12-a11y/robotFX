import { MedicationManagementScreen } from '../../../components/careproof-ui';

type MedicationsPageProps = {
  searchParams?: Promise<{ filter?: string | string[] }>;
};

export default async function ConsoleMedicationsPage({ searchParams }: MedicationsPageProps) {
  const params = await searchParams;
  const filter = Array.isArray(params?.filter) ? params?.filter[0] : params?.filter;
  return <MedicationManagementScreen initialFilter={filter ?? null} />;
}
