# Azure Deployment Guide

This guide provides step-by-step instructions for deploying the Valerix Microservices system to Microsoft Azure.

## Prerequisites

- Azure account with active subscription
- Azure CLI installed (`az` command)
- Docker installed locally
- `kubectl` installed (for AKS deployment)

## Deployment Options

### Option 1: Azure Container Instances (ACI) - Simplest

Best for: Development, testing, simple deployments

**Pros:**

- Fastest to deploy
- Pay-per-second billing
- No cluster management

**Cons:**

- Less control over networking
- Limited scaling options

### Option 2: Azure Kubernetes Service (AKS) - Recommended

Best for: Production, high availability, auto-scaling

**Pros:**

- Full Kubernetes features
- Auto-scaling
- Advanced networking
- High availability

**Cons:**

- More complex setup
- Higher minimum cost

### Option 3: Azure App Service - Web Apps

Best for: Simple microservices without complex orchestration

**Pros:**

- Easy deployment
- Built-in CI/CD
- Auto-scaling

**Cons:**

- Limited container orchestration
- Less flexible networking

---

## Deployment Steps (AKS - Recommended)

### 1. Prepare Azure Resources

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="valerix-rg"
LOCATION="eastus"
ACR_NAME="valerixacr"
AKS_CLUSTER="valerix-aks"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --location $LOCATION

# Create AKS cluster
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER \
  --node-count 2 \
  --node-vm-size Standard_B2s \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys
```

### 2. Build and Push Docker Images

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Tag and push Order Service
docker tag valerix-order-service:latest $ACR_NAME.azurecr.io/order-service:v1
docker push $ACR_NAME.azurecr.io/order-service:v1

# Tag and push Inventory Service
docker tag valerix-inventory-service:latest $ACR_NAME.azurecr.io/inventory-service:v1
docker push $ACR_NAME.azurecr.io/inventory-service:v1
```

### 3. Create Azure Database for PostgreSQL

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name valerix-postgres \
  --location $LOCATION \
  --admin-user valerixadmin \
  --admin-password 'YourSecurePassword123!' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32

# Create databases
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name valerix-postgres \
  --database-name order_db

az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name valerix-postgres \
  --database-name inventory_db

# Configure firewall (allow Azure services)
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name valerix-postgres \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 4. Deploy to AKS

```bash
# Get AKS credentials
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER

# Apply Kubernetes manifests
kubectl apply -f kubernetes/
```

### 5. Configure Monitoring

```bash
# Enable Azure Monitor for containers
az aks enable-addons \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER \
  --addons monitoring
```

---

## Kubernetes Configuration Files

Create the following files in a `kubernetes/` directory:

### `kubernetes/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: valerix
```

### `kubernetes/postgres-secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secrets
  namespace: valerix
type: Opaque
stringData:
  order-db-host: "valerix-postgres.postgres.database.azure.com"
  order-db-user: "valerixadmin"
  order-db-password: "YourSecurePassword123!"
  inventory-db-host: "valerix-postgres.postgres.database.azure.com"
  inventory-db-user: "valerixadmin"
  inventory-db-password: "YourSecurePassword123!"
```

### `kubernetes/order-service.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: valerix
spec:
  replicas: 2
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: valerixacr.azurecr.io/order-service:v1
          ports:
            - containerPort: 3001
          env:
            - name: PORT
              value: "3001"
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: order-db-host
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: order-db-user
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: order-db-password
            - name: DB_NAME
              value: "order_db"
            - name: INVENTORY_SERVICE_URL
              value: "http://inventory-service:3002"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: valerix
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3001
  selector:
    app: order-service
```

### `kubernetes/inventory-service.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inventory-service
  namespace: valerix
spec:
  replicas: 2
  selector:
    matchLabels:
      app: inventory-service
  template:
    metadata:
      labels:
        app: inventory-service
    spec:
      containers:
        - name: inventory-service
          image: valerixacr.azurecr.io/inventory-service:v1
          ports:
            - containerPort: 3002
          env:
            - name: PORT
              value: "3002"
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: inventory-db-host
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: inventory-db-user
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: inventory-db-password
            - name: DB_NAME
              value: "inventory_db"
            - name: ENABLE_GREMLIN
              value: "false"
            - name: ENABLE_CRASH_SIMULATION
              value: "false"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: inventory-service
  namespace: valerix
spec:
  type: ClusterIP
  ports:
    - port: 3002
      targetPort: 3002
  selector:
    app: inventory-service
```

---

## Cost Estimation (Monthly)

### Development Environment

- **AKS Cluster**: ~$73/month (2x Standard_B2s nodes)
- **PostgreSQL Flexible Server**: ~$15/month (Burstable B1ms)
- **Container Registry**: ~$5/month (Basic tier)
- **Azure Monitor**: ~$10/month
- **Total**: ~$103/month

### Production Environment

- **AKS Cluster**: ~$300/month (3x Standard_D2s_v3 nodes with autoscaling)
- **PostgreSQL Flexible Server**: ~$150/month (General Purpose D2s_v3)
- **Container Registry**: ~$20/month (Standard tier)
- **Azure Monitor + App Insights**: ~$50/month
- **Load Balancer**: ~$20/month
- **Total**: ~$540/month

---

## Post-Deployment Steps

### 1. Verify Deployment

```bash
# Check pod status
kubectl get pods -n valerix

# Check services
kubectl get services -n valerix

# Get external IP
kubectl get service order-service -n valerix
```

### 2. Test Services

```bash
# Get the external IP
EXTERNAL_IP=$(kubectl get service order-service -n valerix -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl http://$EXTERNAL_IP/health

# Create test order
curl -X POST http://$EXTERNAL_IP/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-001",
    "productId": "PROD-001",
    "productName": "Test Product",
    "quantity": 1
  }'
```

### 3. Configure Domain (Optional)

```bash
# Create DNS zone
az network dns zone create \
  --resource-group $RESOURCE_GROUP \
  --name yourdomain.com

# Add A record
az network dns record-set a add-record \
  --resource-group $RESOURCE_GROUP \
  --zone-name yourdomain.com \
  --record-set-name api \
  --ipv4-address $EXTERNAL_IP
```

### 4. Enable HTTPS (Optional)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Configure Let's Encrypt issuer
# (See kubernetes/cert-issuer.yaml)
```

---

## Monitoring and Logging

### Azure Monitor Queries

**View service logs:**

```kusto
ContainerLog
| where TimeGenerated > ago(1h)
| where PodName contains "order-service" or PodName contains "inventory-service"
| project TimeGenerated, PodName, LogEntry
| order by TimeGenerated desc
```

**Monitor CPU usage:**

```kusto
Perf
| where TimeGenerated > ago(1h)
| where ObjectName == "K8SContainer"
| where CounterName == "cpuUsageNanoCores"
| summarize avg(CounterValue) by bin(TimeGenerated, 5m), InstanceName
```

---

## Scaling

### Manual Scaling

```bash
# Scale order service
kubectl scale deployment order-service -n valerix --replicas=5

# Scale inventory service
kubectl scale deployment inventory-service -n valerix --replicas=3
```

### Auto-Scaling (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: valerix
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Disaster Recovery

### Backup Strategy

**PostgreSQL Backups:**

- Automated backups enabled by default (7-day retention)
- Point-in-time restore available
- Geo-redundant backups optional

**Application State:**

- Stateless design (no local state)
- All data in PostgreSQL
- Container images in ACR

### Restore Procedure

```bash
# Restore PostgreSQL from backup
az postgres flexible-server restore \
  --resource-group $RESOURCE_GROUP \
  --name valerix-postgres-restored \
  --source-server valerix-postgres \
  --restore-time "2024-01-29T12:00:00Z"
```

---

## Security Best Practices

1. **Secrets Management**
   - Use Azure Key Vault for sensitive data
   - Rotate credentials regularly
   - Never commit secrets to git

2. **Network Security**
   - Use Network Security Groups (NSG)
   - Enable Azure Private Link for PostgreSQL
   - Implement Web Application Firewall (WAF)

3. **Identity Management**
   - Use Managed Identities
   - Implement RBAC
   - Enable Azure AD integration

4. **Monitoring**
   - Enable Azure Security Center
   - Configure alerts for suspicious activity
   - Regular security audits

---

## Troubleshooting

### Common Issues

**Pods not starting:**

```bash
# Check pod status
kubectl describe pod <pod-name> -n valerix

# View logs
kubectl logs <pod-name> -n valerix
```

**Database connection issues:**

```bash
# Check secret
kubectl get secret postgres-secrets -n valerix -o yaml

# Test connection from pod
kubectl exec -it <pod-name> -n valerix -- sh
nc -zv valerix-postgres.postgres.database.azure.com 5432
```

**Service unreachable:**

```bash
# Check service endpoints
kubectl get endpoints -n valerix

# Check ingress
kubectl get ingress -n valerix
```

---

## CI/CD Integration

### GitHub Actions for Azure Deployment

Add to `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to ACR
        run: az acr login --name valerixacr

      - name: Build and push
        run: |
          docker build -t valerixacr.azurecr.io/order-service:${{ github.sha }} ./order-service
          docker push valerixacr.azurecr.io/order-service:${{ github.sha }}

      - name: Deploy to AKS
        run: |
          az aks get-credentials --resource-group valerix-rg --name valerix-aks
          kubectl set image deployment/order-service \
            order-service=valerixacr.azurecr.io/order-service:${{ github.sha }} \
            -n valerix
```

---

## Summary

This guide provides everything needed to deploy Valerix Microservices to Azure. The system is designed to be cloud-ready with:

✅ Containerized architecture  
✅ Stateless services  
✅ External database support  
✅ Health checks  
✅ Metrics endpoints  
✅ Horizontal scaling support

**Next Steps:**

1. Review and customize Kubernetes manifests
2. Set up Azure account and resources
3. Build and push Docker images
4. Deploy to AKS
5. Configure monitoring and alerts
6. Set up CI/CD pipeline
