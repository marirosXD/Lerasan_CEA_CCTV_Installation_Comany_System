# CEA OpsGrid

CEA OpsGrid is a React and Supabase operations system for CEA CCTV Installation Services.

## Supabase setup

1. In the Supabase project, open **SQL Editor** and run [`supabase/migrations/202610080001_cea_opsgrid_rbac.sql`](supabase/migrations/202610080001_cea_opsgrid_rbac.sql). To enable profile pictures, also run [`supabase/migrations/202610080002_profile_photos.sql`](supabase/migrations/202610080002_profile_photos.sql).
2. In **Authentication → Users**, create one login for each person who needs access. This app does not create or store passwords. Supabase Auth handles sign-in and password reset.
3. For each login, add a matching row to `public.profiles`. Use the Auth user's UUID as `id`, and set `role` to `administrator`, `inventory_staff`, or `field_technician`.
4. For technician accounts, update the matching employee row and set `auth_user_id` to that Auth user's UUID. Assigned work orders then become visible to that technician.
5. Add role profiles in the Supabase SQL Editor. For the current preset accounts, run:

   ```sql
   insert into public.profiles (id, full_name, role)
   select id,
     case email
       when 'christopherandal@ceacompany.com' then 'Christopher Andal'
       when 'technicianstaff@ceacompany.com' then 'Field Technician'
     end,
     case email
       when 'christopherandal@ceacompany.com' then 'administrator'
       when 'technicianstaff@ceacompany.com' then 'field_technician'
     end
   from auth.users
   where email in (
     'christopherandal@ceacompany.com',
     'technicianstaff@ceacompany.com'
   )
   on conflict (id) do update
   set full_name = excluded.full_name, role = excluded.role;
   ```

   Repeat with each employee's name and their appropriate role. Roles are enforced by Supabase Row Level Security, not the role selector in the login screen. The selector is a quick access check and must match the signed-in account.

The migration creates the employees listed in the project notes. Link each employee to their account in the Employees screen by entering the Auth user UUID. Accounts can be created in Supabase Auth; role assignments remain administrator-controlled.

## Configuration

Create a local `.env` file from `.env.example`:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

For deployment, add the same variables in your hosting provider's environment settings. The app now refuses to start without these values instead of falling back to hardcoded Supabase keys. The publishable/anon key is intended for browser use; never put a Supabase service-role key in frontend code.

## Run locally

```sh
npm install
npm run dev
```

## Role access

- **Administrator:** work orders and dispatch, inventory, quotations, employee directory, and account settings.
- **Field Technician:** only assigned work orders, their addresses, schedules, and required hardware, plus personal account settings.

Database policies in the migration enforce the same boundaries even if someone bypasses the interface.
