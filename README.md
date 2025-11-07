# 🏗️ Timecard Computing Application

> Application backend de calcul de feuilles de temps pour agents de service
> Architecture: **Clean Architecture** + **Programmation Fonctionnelle** (fp-ts)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![fp-ts](https://img.shields.io/badge/fp--ts-2.16-purple)](https://gcanti.github.io/fp-ts/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Stack Technique](#-stack-technique)
- [Architecture](#-architecture)
  - [Principes](#principes-architecturaux)
  - [Structure des couches](#structure-des-couches)
  - [Flow d'une requête](#flow-dune-requête)
- [Structure du projet](#-structure-du-projet)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [Développement](#-développement)
  - [Ajouter une fonctionnalité](#ajouter-une-nouvelle-fonctionnalité)
  - [Tests](#tests)
  - [Logging](#logging)
- [API Documentation](#-api-documentation)
- [Déploiement](#-déploiement)
- [Monitoring](#-monitoring)
- [Contribution](#-contribution)
- [Ressources](#-ressources)

---

## 🎯 Vue d'ensemble

Cette application calcule automatiquement les feuilles de temps (timecards) des agents de service en :
- Récupérant les données depuis une API externe (care-data-parser)
- Calculant les heures travaillées, heures supplémentaires, majorations
- Générant les tickets restaurant
- Gérant l'intercontrat (affectations Bench)
- Exportant les données pour la paie (CSV vers S3)

### Fonctionnalités principales

- ✅ **Calcul automatique des timecards** par période
- ✅ **Gestion de l'intercontrat** (scheduler 2x/jour)
- ✅ **Export paie** (CSV vers AWS S3)
- ✅ **Validation robuste** (Zod pour toutes les entrées)
- ✅ **Logging structuré** (Winston, traçabilité complète)
- ✅ **Architecture testable** (> 85% coverage)

---

## 🛠️ Stack Technique

### Core
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3+
- **Framework HTTP**: Express 4.18
- **Functional Programming**: fp-ts 2.16

### Librairies
- **Immutability**: Immutable.js
- **Date/Time**: js-joda (comme java.time)
- **Validation**: Zod
- **Logging**: Winston
- **Scheduling**: node-cron
- **HTTP Client**: Axios

### Infrastructure
- **Database**: PostgreSQL (Neon)
- **Storage**: AWS S3
- **External API**: care-data-parser

### Dev Tools
- **Package Manager**: bun
- **Linter**: ESLint
- **Formatter**: Prettier
- **Testing**: Jest

---

## 🏛️ Architecture

### Principes architecturaux

#### 1. Clean Architecture (Uncle Bob)
