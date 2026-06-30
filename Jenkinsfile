pipeline {
  agent any

  triggers {
    githubPush()
  }

  environment {
    APP_NAME = 'smaitic-node-api'
    DOCKER_REGISTRY = 'docker.io'
    DOCKER_NAMESPACE = 'dockersahil01'
    AWS_REGION = 'ap-south-1'
    EKS_CLUSTER = 'smaitic-eks-cluster'
    HELM_RELEASE = 'node-api'
    KUBE_NAMESPACE = 'production'
  }

  stages {
    stage('Code Checkout') {
      steps {
        echo 'Checking out source code from GitHub'
        checkout scm

        script {
          env.IMAGE_TAG = sh(
            script: 'git rev-parse --short=12 HEAD',
            returnStdout: true
          ).trim()

          env.IMAGE_REPOSITORY = "${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${APP_NAME}"
        }
      }
    }

    stage('Install Dependencies') {
      steps {
        echo 'Installing Node.js dependencies'
        sh 'npm ci'
      }
    }

    stage('Validate Application') {
      steps {
        echo 'Validating application build'
        sh 'npm run build'
      }
    }

    stage('Build Docker Image') {
      steps {
        echo 'Building Docker image'
        sh 'docker build -t "$IMAGE_REPOSITORY:$IMAGE_TAG" .'
      }
    }

    stage('Scan Docker Image') {
      steps {
        echo 'Scanning Docker image for vulnerabilities'
        sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL "$IMAGE_REPOSITORY:$IMAGE_TAG"'
      }
    }

    stage('Push Image to DockerHub') {
      steps {
        echo 'Pushing Docker image to DockerHub'
        withCredentials([usernamePassword(
          credentialsId: 'docker-registry-credentials',
          usernameVariable: 'DOCKERHUB_USERNAME',
          passwordVariable: 'DOCKERHUB_PASSWORD'
        )]) {
          sh '''
            echo "$DOCKERHUB_PASSWORD" | docker login "$DOCKER_REGISTRY" -u "$DOCKERHUB_USERNAME" --password-stdin
            docker push "$IMAGE_REPOSITORY:$IMAGE_TAG"
          '''
        }
      }
    }

    stage('Deploy to AWS EKS') {
      steps {
        echo 'Deploying application to AWS EKS using Helm'
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-eks-credentials'
        ]]) {
          sh '''
            aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER"

            helm upgrade --install "$HELM_RELEASE" ./helm/node-api \
              --namespace "$KUBE_NAMESPACE" \
              --create-namespace \
              --set image.repository="$IMAGE_REPOSITORY" \
              --set image.tag="$IMAGE_TAG"
          '''
        }
      }
    }
  }

  post {
    success {
      echo "Pipeline completed successfully. Image deployed: $IMAGE_REPOSITORY:$IMAGE_TAG"
    }

    failure {
      echo 'Pipeline failed. Check Jenkins stage logs for details.'
    }

    always {
      echo 'CI/CD pipeline execution finished.'
    }
  }
}
