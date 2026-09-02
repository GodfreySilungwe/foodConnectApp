export default function ProviderList({ providers = [] }) {
  return (
    <section>
      <h2>Providers</h2>
      {providers.length === 0 ? (
        <p>No providers available yet.</p>
      ) : (
        <ul>
          {providers.map((provider) => (
            <li key={provider.id}>
              <strong>{provider.name}</strong> - {provider.status}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
