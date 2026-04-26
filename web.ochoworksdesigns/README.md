# WebOchoworksdesigns

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.1.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
ng build --configuration=production
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.


Angular CLI: 19.2.15
Node: 22.11.0
Package Manager: npm 10.9.0
OS: darwin x64

Angular: 19.2.14
... animations, common, compiler, compiler-cli, core, forms
... platform-browser, platform-browser-dynamic, platform-server
... router

Package                         Version
---------------------------------------------------------
@angular-devkit/architect       0.1902.15
@angular-devkit/build-angular   19.2.15
@angular-devkit/core            19.2.15
@angular-devkit/schematics      19.2.15
@angular/cli                    19.2.15
@angular/ssr                    19.2.15
@schematics/angular             19.2.15
rxjs                            7.8.2
typescript                      5.7.3
zone.js                         0.15.1

```
web.ochoworksdesigns
├─ .editorconfig
├─ .npmrc
├─ README.md
├─ angular.json
├─ deploy.sh
├─ ecosystem.config.js
├─ package-lock.json
├─ package.json
├─ public
│  ├─ favicon.ico
│  └─ favicon.ico.old
├─ setup-swap.sh
├─ src
│  ├─ app
│  │  ├─ _services
│  │  │  ├─ auth.interceptor.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ blog.service.ts
│  │  │  ├─ contact.service.ts
│  │  │  ├─ email-marketing.service.ts
│  │  │  ├─ google-analytics.service.spec.ts
│  │  │  ├─ google-analytics.service.ts
│  │  │  ├─ plan.service.spec.ts
│  │  │  ├─ plan.service.ts
│  │  │  ├─ seo.service.spec.ts
│  │  │  └─ seo.service.ts
│  │  ├─ about
│  │  │  ├─ about.component.css
│  │  │  ├─ about.component.html
│  │  │  ├─ about.component.spec.ts
│  │  │  └─ about.component.ts
│  │  ├─ app.component.css
│  │  ├─ app.component.html
│  │  ├─ app.component.spec.ts
│  │  ├─ app.component.ts
│  │  ├─ app.config.server.ts
│  │  ├─ app.config.ts
│  │  ├─ app.routes.ts
│  │  ├─ blog-detail
│  │  │  ├─ blog-detail.component.css
│  │  │  ├─ blog-detail.component.html
│  │  │  ├─ blog-detail.component.spec.ts
│  │  │  └─ blog-detail.component.ts
│  │  ├─ blog-edit
│  │  │  ├─ blog-edit.component.css
│  │  │  ├─ blog-edit.component.html
│  │  │  ├─ blog-edit.component.spec.ts
│  │  │  └─ blog-edit.component.ts
│  │  ├─ blog-list
│  │  │  ├─ blog-list.component.css
│  │  │  ├─ blog-list.component.html
│  │  │  ├─ blog-list.component.spec.ts
│  │  │  └─ blog-list.component.ts
│  │  ├─ builders
│  │  │  ├─ builders.component.css
│  │  │  ├─ builders.component.html
│  │  │  ├─ builders.component.spec.ts
│  │  │  └─ builders.component.ts
│  │  ├─ contact
│  │  │  ├─ contact.component.css
│  │  │  ├─ contact.component.html
│  │  │  ├─ contact.component.spec.ts
│  │  │  └─ contact.component.ts
│  │  ├─ footer
│  │  │  ├─ footer.component.css
│  │  │  ├─ footer.component.html
│  │  │  ├─ footer.component.spec.ts
│  │  │  └─ footer.component.ts
│  │  ├─ header
│  │  │  ├─ header.component.css
│  │  │  ├─ header.component.html
│  │  │  ├─ header.component.spec.ts
│  │  │  └─ header.component.ts
│  │  ├─ home
│  │  │  ├─ home.component.css
│  │  │  ├─ home.component.html
│  │  │  ├─ home.component.spec.ts
│  │  │  └─ home.component.ts
│  │  ├─ login
│  │  │  ├─ login.component.css
│  │  │  ├─ login.component.html
│  │  │  ├─ login.component.spec.ts
│  │  │  └─ login.component.ts
│  │  ├─ marketing-contact-edit
│  │  │  ├─ marketing-contact-edit.component.css
│  │  │  ├─ marketing-contact-edit.component.html
│  │  │  ├─ marketing-contact-edit.component.spec.ts
│  │  │  └─ marketing-contact-edit.component.ts
│  │  ├─ marketing-contacts
│  │  │  ├─ marketing-contacts.component.css
│  │  │  ├─ marketing-contacts.component.html
│  │  │  ├─ marketing-contacts.component.spec.ts
│  │  │  └─ marketing-contacts.component.ts
│  │  ├─ marketing-dashboard
│  │  │  ├─ marketing-dashboard.component.css
│  │  │  ├─ marketing-dashboard.component.html
│  │  │  ├─ marketing-dashboard.component.spec.ts
│  │  │  └─ marketing-dashboard.component.ts
│  │  ├─ not-found
│  │  │  ├─ not-found.component.css
│  │  │  ├─ not-found.component.html
│  │  │  ├─ not-found.component.spec.ts
│  │  │  └─ not-found.component.ts
│  │  ├─ plan
│  │  │  ├─ plan.component.css
│  │  │  ├─ plan.component.html
│  │  │  ├─ plan.component.spec.ts
│  │  │  └─ plan.component.ts
│  │  ├─ plan-set
│  │  │  ├─ plan-set.component.css
│  │  │  ├─ plan-set.component.html
│  │  │  ├─ plan-set.component.spec.ts
│  │  │  └─ plan-set.component.ts
│  │  └─ plans
│  │     ├─ plans.component.css
│  │     ├─ plans.component.html
│  │     ├─ plans.component.spec.ts
│  │     └─ plans.component.ts
│  ├─ assets
│  │  ├─ images
│  │  │  ├─ 8-logo.png
│  │  │  ├─ mugshot.jpg
│  │  │  ├─ plan-1.jpeg
│  │  │  └─ plan-1.jpg
│  │  └─ plans
│  │     ├─ pln-0021-1.jpg
│  │     ├─ pln-0021.png
│  │     ├─ pln-0032-1.jpg
│  │     ├─ pln-0123-1.jpg
│  │     ├─ pln-0976.jpg
│  │     ├─ pln-1002.jpg
│  │     ├─ pln-1039.jpg
│  │     └─ pn-0440-1.jpg
│  ├─ environments
│  │  ├─ environment.prod.ts
│  │  └─ environment.ts
│  ├─ index.html
│  ├─ main.server.ts
│  ├─ main.ts
│  ├─ server.ts
│  ├─ styles.css
│  └─ types
├─ tsconfig.app.json
├─ tsconfig.json
└─ tsconfig.spec.json

```
