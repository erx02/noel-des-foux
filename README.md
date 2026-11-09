# Les cadeaux de la famille

Petite application privée pour partager des listes de cadeaux en famille.
L'interface React/TypeScript est compilée en fichiers statiques avec Vite et
hébergée sur GitHub Pages. Authentification, données et synchronisation sont
fournies directement par Supabase ; aucun serveur applicatif permanent n'est
utilisé.

## Architecture et sécurité

- React + TypeScript strict + Vite ; styles CSS sans bibliothèque d'interface.
- Supabase Auth, PostgreSQL et Realtime.
- PostgreSQL RLS et contraintes sont l'autorité de sécurité. Le code du
  navigateur n'est pas une barrière et les règles doivent résister à des appels
  REST directs.
- L'application contient seulement `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY`. Ces valeurs sont publiques ; ne jamais placer une
  clé `service_role` dans les paramètres Vite, dans GitHub Pages ou dans le
  dépôt.
- Les invitations sont gérées depuis le tableau de bord Supabase ; l'application
  ne permet pas l'inscription publique.

Voir [l'architecture et le modèle de menace](./docs/architecture.md),
[les politiques et tests SQL](./docs/security-policies.md) et
[les notes du frontend](./docs/frontend.md).

## Prérequis

- Node.js 22 et npm pour le développement et la compilation.
- Docker Desktop démarré pour les tests PostgreSQL locaux.
- Un projet Supabase sur l'offre gratuite.
- La CLI Supabase est incluse comme dépendance de développement du projet.

## Développement local

1. Installer les dépendances :

   ```sh
   npm ci
   ```

2. Créer le fichier local de configuration :

   ```sh
   cp .env.example .env.local
   ```

   Remplacer les deux valeurs factices par l'URL de projet et la clé publique
   `anon` du projet Supabase. Ne pas ajouter `.env.local` au dépôt. Aucune
   donnée de famille réelle ne doit être placée dans des fixtures ou exemples.

3. Appliquer la migration à un projet Supabase **vide**. Avec la CLI, exécuter
   `supabase login`, puis `supabase link --project-ref <référence-du-projet>` et
   `supabase db push`, ou appliquer
   `supabase/migrations/20261109000000_family_gift_lists.sql` dans le SQL Editor
   Supabase. Ne pas appliquer sans revue cette migration à un projet contenant
   déjà des tables ou politiques.

4. Lancer l'interface :

   ```sh
   npm run dev
   ```

5. Vérifier la compilation de production :

   ```sh
   npm run build
   ```

## Initialiser la première famille et l'administrateur

1. Dans Supabase Auth, désactiver l'inscription publique et créer ou inviter le
   premier compte administrateur avec confirmation d'e-mail activée.
2. Récupérer l'UUID de ce compte dans le tableau de bord.
3. Depuis le SQL Editor Supabase (compte opérateur), exécuter le modèle suivant
   après remplacement des deux UUID et du nom par les valeurs de la famille.
   Ce script d'initialisation est une opération privilégiée, jamais appelée par
   l'application :

   ```sql
   with new_family as (
     insert into public.families (name, created_by)
     values ('Famille à configurer', 'UUID-DU-COMPTE-AUTH'::uuid)
     returning id
   )
   insert into public.family_members (family_id, user_id, display_name, role)
   select id, 'UUID-DU-COMPTE-AUTH'::uuid, 'Prénom affiché', 'admin'
   from new_family;
   ```

   Le texte `UUID-DU-COMPTE-AUTH` doit être remplacé par le véritable UUID ; le
   modèle n'est pas exécutable sans remplacement.
4. Créer/inviter chaque autre compte dans Supabase Auth. Un administrateur
   familial peut ensuite ajouter le membre déjà créé en renseignant son UUID
   dans la page d'administration.
5. Les promotions et changements de rôle ne sont pas disponibles dans
   l'application. Ils restent réservés à l'opérateur du projet Supabase.

`supabase/seed.example.sql` ne contient aucune donnée de démonstration ni
personnelle ; les comptes et données de tests sont synthétiques et annulés dans
la transaction pgTAP.

## Déployer sur GitHub Pages

1. Pousser le dépôt sur GitHub. Le workflow
   [deploy-pages.yml](./.github/workflows/deploy-pages.yml) est prévu pour la
   branche `main` et peut également être lancé manuellement.
2. Dans **Settings → Secrets and variables → Actions → Variables**, définir :
   - `VITE_SUPABASE_URL` — URL du projet Supabase ;
   - `VITE_SUPABASE_ANON_KEY` — clé publique `anon`.

   Ce ne sont pas des secrets d'autorisation. La clé `anon` est publique ; la
   RLS doit protéger les données même si toute personne connaît ces valeurs.
   N'ajouter aucune variable `service_role`.
3. Dans **Settings → Pages**, sélectionner **GitHub Actions** comme source.
4. Vérifier le succès du workflow. Vite choisit automatiquement le préfixe de
   chemin pour une page de projet GitHub Pages. Pour un domaine personnalisé,
   vérifier sa configuration Pages et ajuster la base Vite si nécessaire.
5. Dans Supabase Auth, déclarer l'URL GitHub Pages exacte comme URL de redirection
   autorisée, ainsi que l'URL locale de développement utilisée. Ne pas autoriser
   de redirections génériques.

Le dépôt contient `package-lock.json` et le workflow CI utilise `npm ci` pour
des installations reproductibles.

## Tests des autorisations PostgreSQL

La suite pgTAP utilise des utilisateurs et des données synthétiques dans une
transaction annulée. Avec Supabase local démarré :

```sh
npx supabase start
npx supabase test db
```

Les tests SQL, et non les tests d'interface, valident les règles d'accès.
Exécuter aussi la revue de sécurité avant toute publication : voir
[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md).

## Synchronisation des réservations

Les mises à jour des familles, profils et souhaits utilisent Realtime comme
signal de relecture sécurisée. Les réservations sont volontairement exclues de
la publication Realtime : un événement permettrait au propriétaire du souhait
de déduire qu'un cadeau est réservé, même sans champ d'identité dans son
payload. Leur état est relu après action, au retour réseau/onglet, à la demande
et toutes les 60 secondes.

## Limites d'hébergement et sécurité

GitHub Pages sert des fichiers statiques et ne permet pas à ce projet de définir
les en-têtes HTTP personnalisés. La balise meta CSP réduit certaines surfaces,
mais ne remplace ni `frame-ancestors` HTTP ni `X-Content-Type-Options` et ne
garantit pas une protection complète contre l'intégration en iframe. La
politique `Referrer-Policy` par meta est un complément, pas une promesse.
La CSP présente dans `index.html` couvre les domaines Supabase standards
`*.supabase.co` ; la personnaliser pour un autre domaine exige de revoir et
reconstruire la politique.

Ne jamais publier de données réelles dans des exemples ou le dépôt GitHub.
L'application n'offre pas de sécurité absolue : sécurité des comptes, du projet
Supabase et des postes opérateurs demeurent nécessaires.
