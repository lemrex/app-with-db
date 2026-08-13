# Huawei CCE + CSMS CSI Secret Mount Guide

This guide demonstrates how to retrieve a secret from **Huawei Cloud Secret Management Service (CSMS)** and make the secret available inside a **CCE pod using the Secrets Store CSI Driver**.

The example secret is:

```
CSMS Secret Name: 737

```

The secret contains:

```
{
  "DB_HOST": "192.168.1.16",
  "DB_USER": "root",
  "DB_PASSWORD": "your-password",
  "DB_NAME": "appdb",
  "DB_PORT": "33306"
}

```

> **Security note:** Never commit real passwords to Git. The example above should use a placeholder password in documentation.

---

## 1. Architecture

The flow is:

```
Huawei Cloud CSMS
       |
       | Secret: 737
       v
ServiceAccount
       |
       | cce.io/dew-resource
       v
SecretProviderClass
       |
       | CCE Secrets Store CSI Provider
       v
CCE Pod
       |
       +-- /mnt/secrets-store/dbhost
       +-- /mnt/secrets-store/dbusername
       +-- /mnt/secrets-store/dbpassword
       +-- /mnt/secrets-store/dbname
       +-- /mnt/secrets-store/dbport

```

The application reads the secrets as files from:

```
/mnt/secrets-store

```

---

# 2. Prerequisites

Before deploying this configuration, make sure:

- A CCE cluster exists.
- The CCE cluster has the CCE Secrets Store CSI functionality/provider available.
- A secret named/identified as `737` exists in Huawei CSMS.
- The CSMS secret contains the JSON properties:
  - `DB_HOST`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `DB_PORT`
- The workload is deployed in the same namespace as the `ServiceAccount` and `SecretProviderClass`.

---

# 3. ServiceAccount

The ServiceAccount identifies the CCE workload that is allowed to access the Huawei CSMS resource.

```
apiVersion: v1
kind: ServiceAccount
metadata:
  # ServiceAccount used by the application pod.
  name: spc-db

  annotations:
    # Tell CCE which Huawei CSMS/DEW resource
    # this ServiceAccount is allowed to access.
    #
    # 737 = the CSMS secret/resource ID.
    cce.io/dew-resource: '["737"]'

```

The important part is:

```
cce.io/dew-resource: '["737"]'

```

This associates the ServiceAccount with the Huawei secret resource.

---

# 4. SecretProviderClass

The `SecretProviderClass` tells the CSI provider:

1. Which provider to use.
2. Which Huawei CSMS secret to retrieve.
3. Which fields to extract from the JSON secret.
4. What filenames to create inside the pod.
5. Optionally, which Kubernetes Secret to synchronize.

```
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass

metadata:
  # Name of the SecretProviderClass.
  # This name is referenced by the pod's CSI volume.
  name: spc-az

spec:

  # Huawei CCE CSI provider.
  provider: cce

  parameters:

    # Objects to retrieve from Huawei CSMS.
    objects: |
      - objectName: "737"
        objectType: "csms"
        objectVersion: "latest"

        # Extract individual fields from the JSON secret.
        jmesPath:

          # CSMS DB_HOST -> /mnt/secrets-store/dbhost
          - path: DB_HOST
            objectAlias: dbhost

          # CSMS DB_PASSWORD -> /mnt/secrets-store/dbpassword
          - path: DB_PASSWORD
            objectAlias: dbpassword

          # CSMS DB_USER -> /mnt/secrets-store/dbusername
          - path: DB_USER
            objectAlias: dbusername

          # CSMS DB_NAME -> /mnt/secrets-store/dbname
          - path: DB_NAME
            objectAlias: dbname

          # CSMS DB_PORT -> /mnt/secrets-store/dbport
          - path: DB_PORT
            objectAlias: dbport

  # Optional:
  # Synchronize the mounted values into a Kubernetes Secret.
  #
  # This Secret is only created after a pod actually mounts
  # this SecretProviderClass.
  secretObjects:

    - secretName: app-secret
      type: Opaque

      data:
        - objectName: dbhost
          key: DB_HOST

        - objectName: dbpassword
          key: DB_PASSWORD

        - objectName: dbusername
          key: DB_USER

        - objectName: dbname
          key: DB_NAME

        - objectName: dbport
          key: DB_PORT

```

---

# 5. What `jmesPath` does

The CSMS secret is one JSON object:

```
{
  "DB_HOST": "192.168.1.16",
  "DB_USER": "root",
  "DB_PASSWORD": "your-password",
  "DB_NAME": "appdb",
  "DB_PORT": "33306"
}

```

The `jmesPath` configuration extracts individual fields.

For example:

```
- path: DB_HOST
  objectAlias: dbhost

```

means:

```
DB_HOST
   |
   v
dbhost

```

Inside the pod, the CSI driver creates:

```
/mnt/secrets-store/dbhost

```

containing:

```
192.168.1.16

```

Similarly:

```
DB_USER
    |
    v
dbusername
    |
    v
/mnt/secrets-store/dbusername

```

---

# 6. Expected mounted files

After a pod mounts the `SecretProviderClass`, the container should have:

```
/mnt/secrets-store/
├── dbhost
├── dbusername
├── dbpassword
├── dbname
└── dbport

```

You can verify this with:

```
kubectl exec -it <pod-name> -n <namespace> -- \
  ls -la /mnt/secrets-store

```

To test a non-sensitive value:

```
kubectl exec -it <pod-name> -n <namespace> -- \
  cat /mnt/secrets-store/dbhost

```

Expected:

```
192.168.1.16

```

Avoid printing the password unnecessarily.

---

# 7. Mounting the SecretProviderClass in a Pod

The `SecretProviderClass` does not automatically get mounted into every pod.

Your Deployment must explicitly reference it.

Example:

```
apiVersion: apps/v1
kind: Deployment

metadata:
  name: db-test
  namespace: azure

spec:
  replicas: 1

  selector:
    matchLabels:
      app: db-test

  template:

    metadata:
      labels:
        app: db-test

    spec:

      # IMPORTANT:
      # The pod must use the ServiceAccount that has
      # permission to access CSMS secret 737.
      serviceAccountName: spc-db

      containers:

        - name: db-test
          image: <SWR_REGISTRY>/ralf/bar:latest

          ports:
            - containerPort: 3000

          volumeMounts:

            # Mount the CSI secret filesystem into the container.
            - name: secrets-store

              # Your application reads files from this directory.
              mountPath: /mnt/secrets-store

              readOnly: true

      volumes:

        - name: secrets-store

          csi:
            driver: secrets-store.csi.k8s.io

            readOnly: true

            volumeAttributes:

              # This must match:
              # SecretProviderClass.metadata.name
              secretProviderClass: spc-az

```

The important relationship is:

```
ServiceAccount
     |
     | serviceAccountName
     v
    Pod
     |
     | secretProviderClass
     v
SecretProviderClass
     |
     v
Huawei CSMS

```

---

# 8. Deploy the configuration

Save the ServiceAccount and SecretProviderClass as:

```
secretproviderclass.yaml

```

Then apply:

```
kubectl apply -f secretproviderclass.yaml

```

Verify:

```
kubectl get serviceaccount spc-db -n azure

```

and:

```
kubectl get secretproviderclass spc-az -n azure

```

---

# 9. Deploy the application

Apply your Deployment:

```
kubectl apply -f deployment.yaml

```

Check the pod:

```
kubectl get pods -n azure

```

Then inspect it:

```
kubectl describe pod <pod-name> -n azure

```

Look for the CSI volume and mount.

---

# 10. Verify the mounted secrets

Run:

```
kubectl exec -it <pod-name> -n azure -- \
  ls -la /mnt/secrets-store

```

Expected:

```
dbhost
dbusername
dbpassword
dbname
dbport

```

Test:

```
kubectl exec -it <pod-name> -n azure -- \
  cat /mnt/secrets-store/dbhost

```

Expected:

```
192.168.1.16

```

Test the database username:

```
kubectl exec -it <pod-name> -n azure -- \
  cat /mnt/secrets-store/dbusername

```

Expected:

```
root

```

Do not routinely run:

```
cat /mnt/secrets-store/dbpassword

```

because this exposes the password in your terminal/session history or screenshots.

---

# 11. Kubernetes Secret synchronization

This configuration also contains:

```
secretObjects:
  - secretName: app-secret

```

This tells the Secrets Store CSI Driver to synchronize the mounted secret into a Kubernetes Secret.

However, there is an important behavior to understand:

> `app-secret` is created when a pod actually mounts the `SecretProviderClass`. Applying only the `SecretProviderClass` does not necessarily create `app-secret`.

After the application pod starts, check:

```
kubectl get secret app-secret -n azure

```

You should see:

```
NAME          TYPE     DATA   AGE
app-secret    Opaque    5      ...

```

Then:

```
kubectl describe secret app-secret -n azure

```

You should see:

```
Data
====
DB_HOST
DB_PASSWORD
DB_USER
DB_NAME
DB_PORT

```

The actual secret values will not be displayed by `describe`.

---

# 12. Mounted files vs Kubernetes Secret

With this configuration you can use either approach.

### Mounted files

Your application reads:

```
/mnt/secrets-store/dbhost
/mnt/secrets-store/dbusername
/mnt/secrets-store/dbpassword
/mnt/secrets-store/dbname
/mnt/secrets-store/dbport

```

This is the primary CSI approach.

### Kubernetes Secret

The CSI driver can also synchronize the values into:

```
app-secret

```

Then another container/application could consume them as environment variables:

```
envFrom:
  - secretRef:
      name: app-secret

```

The two approaches are different:

```
CSMS
 │
 ▼
SecretProviderClass
 │
 ├───────────────► CSI mounted files
 │                 /mnt/secrets-store/*
 │
 └───────────────► Kubernetes Secret
                   app-secret

```

For a CSI-focused implementation, your application can simply consume the mounted files.

---

# 13. Troubleshooting

### Check the SecretProviderClass

```
kubectl describe secretproviderclass spc-az -n azure

```

### Check the pod

```
kubectl describe pod <pod-name> -n azure

```

Pay particular attention to the **Events** section.

### Check the CSI driver

```
kubectl get pods -A | grep -i secrets

```

### Check the mounted directory

```
kubectl exec -it <pod-name> -n azure -- \
  ls -la /mnt/secrets-store

```

### Check the ServiceAccount

```
kubectl get serviceaccount spc-db -n azure -o yaml

```

Make sure it contains:

```
annotations:
  cce.io/dew-resource: '["737"]'

```

### Check that the pod uses the ServiceAccount

```
kubectl get pod <pod-name> -n azure \
  -o jsonpath='{.spec.serviceAccountName}'

```

Expected:

```
spc-db

```

---

# 14. Important security practices

Do not put the actual password directly into:

```
deployment.yaml
Dockerfile
server.js
Git repository
README.md
CI/CD YAML

```

The application should receive the password through CSMS.

Also avoid endpoints such as:

```
/env

```

returning:

```
{
  "DB_PASSWORD": "actual-password"
}

```

If this application is exposed through a NodePort, load balancer, ingress, or public endpoint, anyone who can reach that endpoint could potentially retrieve the credential.

For testing, use:

```
{
  "DB_HOST": "192.168.1.16",
  "DB_USER": "root",
  "DB_PASSWORD": "********",
  "DB_NAME": "appdb",
  "DB_PORT": "33306"
}

```

instead.

---

# 15. Final deployment flow

The complete setup is:

```
                    Huawei Cloud
                         │
                         ▼
                 ┌──────────────┐
                 │     CSMS     │
                 │              │
                 │ Secret: 737  │
                 └──────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │ SecretProvider│
                │    Class      │
                │    spc-az     │
                └───────┬───────┘
                        │
                 CSI Provider
                        │
                        ▼
                 ┌──────────────┐
                 │   CCE Pod    │
                 │              │
                 │ /mnt/        │
                 │ secrets-store│
                 │              │
                 │ dbhost       │
                 │ dbusername   │
                 │ dbpassword   │
                 │ dbname       │
                 │ dbport       │
                 └──────┬───────┘
                        │
                        │ DB connection
                        ▼
                192.168.1.16:33306
                        │
                        ▼
                    MySQL DB

```

The critical configuration pieces are therefore:

```
serviceAccountName: spc-db

```

and:

```
volumeAttributes:
  secretProviderClass: spc-az

```

and:

```
volumeMounts:
  - name: secrets-store
    mountPath: /mnt/secrets-store
    readOnly: true

```

Those three pieces connect your **CCE workload → CSI provider → Huawei CSMS**.
