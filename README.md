## Career Objective

My career objective is to grow as a DevOps Engineer by applying my knowledge and understanding of core IT/DevOps concepts. I want to connect these concepts in practical ways to build reliable, secure, and scalable systems.

## Project Overview

This repository contains a production-ready DevOps setup for a simple stateless Node.js API. In this project, I have containerized the application securely, defined a Jenkins CI/CD pipeline, and provided Helm-based Kubernetes deployment configuration for an AWS EKS environment.

The application exposes:

- `/` for a basic API response
- `/healthz` for Kubernetes liveness checks
- `/readyz` for Kubernetes readiness checks
- `/metrics` for Prometheus scraping

## Target Infrastructure

- Docker: To containerize the stateless Node.js API.
- Kubernetes: AWS EKS for running the application.
- CI/CD: Jenkins for Continuous Integration and Continuous Deployment.
- Package management: Helm as the Kubernetes package manager.
- Metrics and monitoring: Prometheus for collecting application metrics from the `/metrics` endpoint. Grafana can be used on top of Prometheus for dashboard visualization in a production setup.
- Logging and APM: The application writes logs to stdout/stderr so they can be collected by a Kubernetes log collector and forwarded to the ELK Stack in a production setup.
- Container registry: Docker Hub for storing the Docker image.

## Repository Structure

```text
|-- Dockerfile
|-- Jenkinsfile
|-- README.md
|-- package.json
|-- package-lock.json
|-- src/
|   |-- server.js
|-- helm/
    |-- node-api/
        |-- Chart.yaml
        |-- values.yaml
        |-- templates/
            |-- _helpers.tpl
            |-- configmap.yaml
            |-- deployment.yaml
            |-- hpa.yaml
            |-- ingress.yaml
            |-- service.yaml
            |-- serviceaccount.yaml
            |-- servicemonitor.yaml
```

## Assumptions

- The AWS EKS cluster is already created and available for deployment.
- Jenkins is running on a Linux machine with Node.js, npm, Docker, Trivy, AWS CLI, kubectl, and Helm installed.
- Docker Hub credentials are expected to be stored in Jenkins Credentials using the ID `docker-registry-credentials`.
- AWS credentials for accessing EKS are expected to be stored in Jenkins Credentials using the ID `aws-eks-credentials`.
- The EKS cluster name used in the Jenkinsfile is `smaitic-eks-cluster`, and the region is `ap-south-1`. These are placeholders and should be replaced with the real cluster details before deployment.
- The ingress hostname is kept as `node-api.example.com`. This needs to be replaced with an actual domain pointing to the load balancer or ingress controller.
- The ServiceMonitor assumes that Prometheus Operator is already installed in the Kubernetes cluster.
- Grafana is assumed to be connected to Prometheus as a data source for viewing dashboards and visualizing application and Kubernetes metrics.
- A Kubernetes log collector such as Filebeat or Fluent Bit is assumed to be installed to forward container stdout/stderr logs to the ELK Stack.
- The ELK Stack is assumed to be available separately, where Elasticsearch stores logs, Logstash processes them, and Kibana is used to search and visualize logs.
- I have used only a Helm chart for Kubernetes deployment configuration.

## Application Design

The Node.js API is small and stateless, and it uses Node.js built-in HTTP functionality. This app supports Kubernetes health management through `/healthz` and `/readyz`, and it exposes basic Prometheus metrics through `/metrics`.

## Dockerfile

The Dockerfile is the improved version of the provided Dockerfile:

- Uses `node:22-alpine` instead of `node:latest`
- Uses a multi-stage build
- Uses `npm ci` for clean dependency installation
- Runs `npm run build` to validate the application
- Installs only production dependencies in the final image
- Sets `NODE_ENV=production`
- Runs as the non-root `node` user
- Starts the app directly with `node src/server.js` to avoid the npm wrapper at runtime.

## Build locally for validation

```bash
docker build -t smaitic-node-api:local .
```

Run locally:

```bash
docker run --rm -p 3000:3000 smaitic-node-api:local
```

Verify:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
curl http://localhost:3000/metrics
```
In real production, the application is deployed to Kubernetes/EKS using Helm. The Docker run command is only for local container validation.

## Jenkins CI/CD Pipeline

The Jenkins pipeline is defined in `Jenkinsfile` and is designed to be triggered by a GitHub webhook on push events.

Pipeline stages:

- Checkout source code from GitHub
- Generate Docker image tag from the short Git commit SHA
- Install Node.js dependencies with `npm ci`
- Validate the application with `npm run build`
- Build the Docker image
- Scan the image using Trivy for high and critical vulnerabilities
- Push the image to Docker Hub
- Deploy the image to AWS EKS using Helm

The image repository is:

```text
docker.io/dockersahil01/smaitic-node-api
```
Here, dockersahil01 is my Docker Hub username and smaitic-node-api is the Docker image repository name. These values can be changed according to the Docker registry and repository used in a real environment.

Images are tagged with the Git commit SHA for traceability. The pipeline uses the command `git rev-parse --short=12 HEAD`, which takes the first 12 characters of the current Git commit hash and uses it as the Docker image tag.

## Required Jenkins credentials:

Create the credentials with exactly the following IDs:

```text
docker-registry-credentials - Used for Docker Hub login and image push.
aws-eks-credentials - Used for AWS access and EKS deployment.
```

GitHub webhook endpoint example:

Add the following URL in the GitHub repository webhook settings:

```text
https://<jenkins-domain>/github-webhook/
```
NOTE: Enable `GitHub hook trigger for GITScm polling`, in the Build Triggers for the Jenkins Job.  

## Helm Deployment

The deployment configuration is provided as a Helm chart under:

```text
helm/node-api - Location of the Kubernetes YAML files
```

Install or upgrade the chart:

```bash
helm upgrade --install node-api ./helm/node-api \
  --namespace production \
  --create-namespace \
  --set image.repository=docker.io/dockersahil01/smaitic-node-api \
  --set image.tag=<commit-sha>
```

Render templates locally:

```bash
helm template node-api ./helm/node-api
```

Lint the chart:

```bash
helm lint ./helm/node-api
```

## Kubernetes Resources

The Helm chart includes:

- Deployment
- Service
- Ingress
- ConfigMap
- ServiceAccount
- HorizontalPodAutoscaler
- ServiceMonitor

The main container port is named `api-web` as required:

```yaml
ports:
  - name: api-web
    containerPort: 3000
```

The Service forwards traffic to the named port:

```yaml
targetPort: api-web
```

## Kubernetes Health Checks

The Deployment defines:

- Liveness probe on `/healthz`
- Readiness probe on `/readyz`

The liveness probe allows Kubernetes to restart unhealthy containers. The readiness probe prevents traffic from being routed to a pod until it is ready.

## Scaling

The chart includes a Horizontal Pod Autoscaler:

- Minimum replicas: 2
- Maximum replicas: 5
- CPU target utilization: 70%

Because the API is stateless, it can be safely scaled horizontally.

## Monitoring With Prometheus And Grafana

The application exposes Prometheus-formatted metrics at:

```text
/metrics
```

The Helm chart includes a `ServiceMonitor` so Prometheus Operator can discover and scrape the service on the `api-web` port. Grafana can then be used to visualize request count, uptime, pod health, CPU, and memory metrics.

## Logging And APM With ELK

The application writes logs to stdout/stderr, which is the recommended logging pattern for containers. In an EKS production environment, a log collector such as Filebeat or Fluent Bit can collect container logs and forward them to Logstash or Elasticsearch.

Kibana can then be used to search, filter, and analyze application logs. For APM, trace IDs or correlation IDs can be added at the application layer in future iterations.

## Security Considerations

- Uses a fixed Node.js image version instead of `latest`
- Non-root user for container execution
- Production-only dependency installation
- Kubernetes resource requests and limits
- Read-only root filesystem
- Linux capabilities dropped
- No secrets stored in source code
- Jenkins credentials used for Docker Hub and AWS access
- Image vulnerability scanning included in CI/CD

## Local Development

Install dependencies:

```bash
npm ci
```

Validate application:

```bash
npm run build
```

Start application:

```bash
npm start
```

The API listens on port `3000` by default.

## Production Notes

Before running this against a real EKS cluster, update:

- `EKS_CLUSTER` in `Jenkinsfile`
- `AWS_REGION` if required
- Docker Hub username and repository
- Docker Hub namespace if needed
- Ingress host in `helm/node-api/values.yaml`
- Jenkins credential IDs if your Jenkins instance uses different names

The final deployment command is handled by Jenkins using:

```bash
helm upgrade --install
```
