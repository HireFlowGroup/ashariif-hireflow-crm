import type { ContactListItem } from "@/lib/contacts/format";
import { formatConfidence, formatContactName } from "@/lib/contacts/format";

type CompanyContactsTableProps = {
  contacts: ContactListItem[];
};

export function CompanyContactsTable({ contacts }: CompanyContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Nog geen contactpersonen. Gebruik &quot;Zoek contactpersonen&quot; om te starten.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Naam</th>
            <th className="px-4 py-3 font-medium">Functie</th>
            <th className="px-4 py-3 font-medium">E-mail</th>
            <th className="px-4 py-3 font-medium">LinkedIn</th>
            <th className="px-4 py-3 font-medium">Telefoon</th>
            <th className="px-4 py-3 font-medium">Bron</th>
            <th className="px-4 py-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium">{formatContactName(contact)}</td>
              <td className="px-4 py-3">{contact.jobTitle ?? "—"}</td>
              <td className="px-4 py-3">{contact.email ?? "—"}</td>
              <td className="px-4 py-3">
                {contact.linkedinUrl ? (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Profiel
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">{contact.phone ?? "—"}</td>
              <td className="px-4 py-3">{contact.source ?? "—"}</td>
              <td className="px-4 py-3">{formatConfidence(contact.confidence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
