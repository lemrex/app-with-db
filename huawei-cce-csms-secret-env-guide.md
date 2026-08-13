# Huawei CCE + CSMS CSI Secret to Environment Variables Guide

This guide demonstrates how to retrieve a secret from **Huawei Cloud Secret Management Service (CSMS)** and expose the secret to a **CCE pod as environment variables** using the **Secrets Store CSI Driver**.

The approach is:

```text
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
CSI-mounted secret
       |
       | sync
       v
Kubernetes Secret: app-secret
       |
       | envFrom / secretKeyRef
       v
CCE Pod Environment Variables
```

> **Security note:** Never commit real passwords to Git. Use placeholders in documentation and source control.

---

# 1. Prerequisites

Before deploying this configuration, make sure:

- A CCE cluster exists.
- The CCE cluster has the CCE Secrets Store CSI functionality/provider available.
- A secret identified as `737` exists in Huawei CSMS.
- The CSMS secret contains the JSON properties:
  - `DB_HOST`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `DB_PORT`
- The workload is deployed in the same namespace as the `ServiceAccount` and `SecretProviderClass`.

---

# 2. CSMS Secret

The example CSMS secret contains:

```json
{
  "DB_HOST": "192.168.1.16",
  "DB_USER": "root",
  "DB_PASSWORD": "your-password",
  "DB_NAME": "appdb",
  "DB_PORT": "33306"
}
```

The CSMS Secret ID is:

```text
737
```

The values will ultimately become environment variables inside the application container.

---

# 3. ServiceAccount

The ServiceAccount identifies the CCE workload that is allowed to access the Huawei CSMS resource.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: spc-db
  namespace: azure
  annotations:
    # 737 = the CSMS secret/resource ID.
    cce.io/dew-resource: '["737"]'
```

The important configuration is:

```yaml
annotations:
  cce.io/dew-resource: '["737"]'
```

This associates the ServiceAccount with the Huawei CSMS resource.

---

# 4. SecretProviderClass

The `SecretProviderClass` tells the CSI provider:

1. Which provider to use.
2. Which Huawei CSMS secret to retrieve.
3. Which fields to extract from the JSON secret.
4. Which Kubernetes Secret should be created from those values.

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: spc-az
  namespace: azure

spec:
  provider: cce

  parameters:
    objects: |
      - objectName: "737"
        objectType: "csms"
        objectVersion: "latest"

        jmesPath:
          - path: DB_HOST
            objectAlias: dbhost

          - path: DB_PASSWORD
            objectAlias: dbpassword

          - path: DB_USER
            objectAlias: dbusername

          - path: DB_NAME
            objectAlias: dbname

          - path: DB_PORT
            objectAlias: dbport

  # Synchronize the mounted values into a Kubernetes Secret.
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

# 5. Understanding `jmesPath`

The CSMS secret is a single JSON object:

```json
{
  "DB_HOST": "192.168.1.16",
  "DB_USER": "root",
  "DB_PASSWORD": "your-password",
  "DB_NAME": "appdb",
  "DB_PORT": "33306"
}
```

The `jmesPath` section extracts individual properties.

For example:

```yaml
- path: DB_HOST
  objectAlias: dbhost
```

This maps:

```text
DB_HOST
   |
   v
dbhost
```

The alias is then referenced by the `secretObjects` section:

```yaml
- objectName: dbhost
  key: DB_HOST
```

The result is a Kubernetes Secret named:

```text
app-secret
```

with these keys:

```text
DB_HOST
DB_PASSWORD
DB_USER
DB_NAME
DB_PORT
```

---

# 6. Kubernetes Secret Synchronization

The following section is what makes the values available as a normal Kubernetes Secret:

```yaml
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

The resulting Kubernetes Secret is:

```text
app-secret
```

with:

```text
DB_HOST
DB_PASSWORD
DB_USER
DB_NAME
DB_PORT
```

> **Important:** `app-secret` is created when a pod actually mounts the `SecretProviderClass`. Applying only the `SecretProviderClass` does not necessarily create the Kubernetes Secret.

---

# 7. Deployment Using Environment Variables

Instead of mounting the secret files into the application, the application can consume the synchronized Kubernetes Secret through environment variables.

Example:

```yaml
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
      serviceAccountName: spc-db

      containers:
        - name: db-test
          image: <SWR_REGISTRY>/ralf/bar:latest

          ports:
            - containerPort: 3000

          envFrom:
            - secretRef:
                name: app-secret

          volumeMounts:
            - name: secrets-store
              mountPath: /mnt/secrets-store
              readOnly: true

      volumes:
        - name: secrets-store
          csi:
            driver: secrets-store.csi.k8s.io
            readOnly: true

            volumeAttributes:
              secretProviderClass: spc-az
```

### Important

Even though the application consumes the values through environment variables, the CSI volume is still required to trigger the `SecretProviderClass` and create/synchronize `app-secret`.

The flow is:

```text
Pod
 |
 | mounts CSI volume
 v
SecretProviderClass
 |
 v
Huawei CSMS
 |
 v
app-secret
 |
 | envFrom
 v
Container environment
```

The application itself does not need to read:

```text
/mnt/secrets-store/*
```

It reads:

```text
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
DB_PORT
```

from its environment.

---

# 8. Alternative: Explicit `secretKeyRef`

Instead of importing the entire Kubernetes Secret using `envFrom`, you can map each key individually.

```yaml
env:
  - name: DB_HOST
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DB_HOST

  - name: DB_USER
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DB_USER

  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DB_PASSWORD

  - name: DB_NAME
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DB_NAME

  - name: DB_PORT
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DB_PORT
```

This is useful when the application should receive only selected keys.

For example:

```yaml
containers:
  - name: db-test
    image: <SWR_REGISTRY>/ralf/bar:latest

    env:
      - name: DB_HOST
        valueFrom:
          secretKeyRef:
            name: app-secret
            key: DB_HOST

      - name: DB_USER
        valueFrom:
          secretKeyRef:
            name: app-secret
            key: DB_USER

      - name: DB_PASSWORD
        valueFrom:
          secretKeyRef:
            name: app-secret
            key: DB_PASSWORD

      - name: DB_NAME
        valueFrom:
          secretKeyRef:
            name: app-secret
            key: DB_NAME

      - name: DB_PORT
        valueFrom:
          secretKeyRef:
            name: app-secret
            key: DB_PORT
```

---

# 9. Deploy the Configuration

Save the ServiceAccount and SecretProviderClass as:

```text
secretproviderclass.yaml
```

Apply:

```bash
kubectl apply -f secretproviderclass.yaml
```

Verify the ServiceAccount:

```bash
kubectl get serviceaccount spc-db -n azure
```

Verify the SecretProviderClass:

```bash
kubectl get secretproviderclass spc-az -n azure
```

---

# 10. Deploy the Application

Apply the Deployment:

```bash
kubectl apply -f deployment.yaml
```

Check the pod:

```bash
kubectl get pods -n azure
```

Then inspect it:

```bash
kubectl describe pod <pod-name> -n azure
```

Pay particular attention to the **Events** section.

---

# 11. Verify the Kubernetes Secret

After the application pod starts:

```bash
kubectl get secret app-secret -n azure
```

Expected:

```text
NAME          TYPE     DATA   AGE
app-secret    Opaque   5      ...
```

You can inspect the Secret metadata:

```bash
kubectl describe secret app-secret -n azure
```

Expected keys:

```text
Data
====
DB_HOST
DB_PASSWORD
DB_USER
DB_NAME
DB_PORT
```

The actual secret values are not displayed by `describe`.

---

# 12. Verify Environment Variables

To verify the non-sensitive values:

```bash
kubectl exec -it <pod-name> -n azure -- \
  printenv DB_HOST
```

Expected:

```text
192.168.1.16
```

Verify the username:

```bash
kubectl exec -it <pod-name> -n azure -- \
  printenv DB_USER
```

Expected:

```text
root
```

Verify the database name:

```bash
kubectl exec -it <pod-name> -n azure -- \
  printenv DB_NAME
```

Expected:

```text
appdb
```

Verify the port:

```bash
kubectl exec -it <pod-name> -n azure -- \
  printenv DB_PORT
```

Expected:

```text
33306
```

Avoid running:

```bash
kubectl exec -it <pod-name> -n azure -- \
  printenv DB_PASSWORD
```

because this exposes the password in your terminal, screenshots, logs, or session history.

---

# 13. Application Configuration

Once injected using `envFrom`, the application can access the values normally.

For Node.js:

```javascript
const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
const dbPort = process.env.DB_PORT;
```

For example:

```javascript
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT)
};
```

The application does not need to know anything about Huawei CSMS.

Its dependency is simply:

```text
Environment Variables
        |
        v
Application
```

---

# 14. Troubleshooting

## Check the SecretProviderClass

```bash
kubectl describe secretproviderclass spc-az -n azure
```

## Check the pod

```bash
kubectl describe pod <pod-name> -n azure
```

Pay particular attention to the **Events** section.

## Check the CSI driver

```bash
kubectl get pods -A | grep -i secrets
```

## Check the Kubernetes Secret

```bash
kubectl get secret app-secret -n azure
```

## Check the ServiceAccount

```bash
kubectl get serviceaccount spc-db -n azure -o yaml
```

Make sure it contains:

```yaml
annotations:
  cce.io/dew-resource: '["737"]'
```

## Check that the pod uses the ServiceAccount

```bash
kubectl get pod <pod-name> -n azure \
  -o jsonpath='{.spec.serviceAccountName}'
```

Expected:

```text
spc-db
```

## Check environment variables

```bash
kubectl exec -it <pod-name> -n azure -- \
  printenv | grep '^DB_'
```

> Do not use this command in production troubleshooting if it will expose `DB_PASSWORD`.

A safer check is:

```bash
kubectl exec -it <pod-name> -n azure -- \
  sh -c 'printf "DB_HOST=%s\nDB_USER=%s\nDB_NAME=%s\nDB_PORT=%s\n" "$DB_HOST" "$DB_USER" "$DB_NAME" "$DB_PORT"'
```

---

# 15. Important Security Practices

Do not put the actual password directly into:

```text
deployment.yaml
Dockerfile
server.js
Git repository
README.md
CI/CD YAML
```

The application should receive the password through CSMS.

Also avoid endpoints such as:

```text
/env
```

returning:

```json
{
  "DB_PASSWORD": "actual-password"
}
```

If the application is exposed through a NodePort, load balancer, ingress, or public endpoint, anyone who can reach that endpoint could potentially retrieve the credential.

For testing, use:

```json
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

# 16. Complete Deployment Example

The following example uses CSMS → CSI → Kubernetes Secret → environment variables.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: spc-db
  namespace: azure
  annotations:
    cce.io/dew-resource: '["737"]'
---
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: spc-az
  namespace: azure

spec:
  provider: cce

  parameters:
    objects: |
      - objectName: "737"
        objectType: "csms"
        objectVersion: "latest"

        jmesPath:
          - path: DB_HOST
            objectAlias: dbhost

          - path: DB_PASSWORD
            objectAlias: dbpassword

          - path: DB_USER
            objectAlias: dbusername

          - path: DB_NAME
            objectAlias: dbname

          - path: DB_PORT
            objectAlias: dbport

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
---
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
      serviceAccountName: spc-db

      containers:
        - name: db-test
          image: <SWR_REGISTRY>/ralf/bar:latest

          ports:
            - containerPort: 3000

          envFrom:
            - secretRef:
                name: app-secret

          volumeMounts:
            - name: secrets-store
              mountPath: /mnt/secrets-store
              readOnly: true

      volumes:
        - name: secrets-store
          csi:
            driver: secrets-store.csi.k8s.io
            readOnly: true

            volumeAttributes:
              secretProviderClass: spc-az
```

---

# 17. Final Architecture

```text
                         Huawei Cloud
                              |
                              v
                     +----------------+
                     |      CSMS      |
                     |   Secret: 737  |
                     +-------+--------+
                             |
                             v
                     +----------------+
                     | SecretProvider |
                     |     Class      |
                     |     spc-az     |
                     +-------+--------+
                             |
                             | CSI Provider
                             v
                     +----------------+
                     |   CCE Pod      |
                     |                |
                     | CSI mount      |
                     |      |         |
                     |      v         |
                     |  app-secret    |
                     |      |         |
                     |      | envFrom |
                     |      v         |
                     | DB_HOST        |
                     | DB_USER        |
                     | DB_PASSWORD    |
                     | DB_NAME        |
                     | DB_PORT        |
                     +-------+--------+
                             |
                             | DB connection
                             v
                     192.168.1.16:33306
                             |
                             v
                          MySQL DB
```

The critical pieces are:

```yaml
serviceAccountName: spc-db
```

which gives the pod access to the CSMS resource,

```yaml
volumeAttributes:
  secretProviderClass: spc-az
```

which triggers the CSI provider and secret synchronization,

and:

```yaml
envFrom:
  - secretRef:
      name: app-secret
```

which exposes the synchronized Kubernetes Secret as environment variables.

Therefore the application receives:

```text
CSMS
  ↓
SecretProviderClass
  ↓
Kubernetes Secret
  ↓
Environment Variables
  ↓
Application
```

without the application needing to directly interact with CSMS.
