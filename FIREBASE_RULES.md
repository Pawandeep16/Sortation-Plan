# Firebase Realtime Database Security Rules

Apply these security rules to your Firebase Realtime Database to restrict read/write access based on user authentication.

## Rules JSON

```json
{
  "rules": {
    "departments": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "employees": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "tasks": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "time_entries": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "shifts": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "employee_shifts": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "breaks": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## How to Apply:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Realtime Database** section
4. Click on the **Rules** tab
5. Replace the existing rules with the JSON above
6. Click **Publish**

## Security Details:

- **`.read: "auth != null"`** - Only authenticated users can read data
- **`.write: "auth != null"`** - Only authenticated users can write/update data
- All paths require authentication (user must be logged in)
- No anonymous access is allowed
- Users have equal access - further restrictions can be added per user if needed
