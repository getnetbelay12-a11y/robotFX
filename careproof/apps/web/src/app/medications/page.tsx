import { MedicationManagementScreen } from '../../components/careproof-ui';

type MedicationsAliasPageProps = {
  searchParams?: Promise<{ filter?: string | string[] }>;
};

export default async function MedicationsAliasPage({ searchParams }: MedicationsAliasPageProps) {
  const params = await searchParams;
  const filter = Array.isArray(params?.filter) ? params?.filter[0] : params?.filter;
  return <MedicationManagementScreen initialFilter={filter ?? null} />;
}
