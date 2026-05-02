import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './_services/auth.service';

// Auth Guard Function
export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};

// Guest Guard Function (redirect to home if already logged in)
export const guestGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    router.navigate(['/home']);
    return false;
  } else {
    return true;
  }
};

export const unsavedChangesGuard = (component: { canDeactivate?: () => boolean }) => {
  if (typeof component?.canDeactivate === 'function') {
    return component.canDeactivate();
  }
  return true;
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent),
    title: 'OchoWorks Designs'
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent),
    title: 'About Us - OchoWorks Designs'
  },
  {
    path: 'custom-home-design',
    loadComponent: () => import('./custom-home-design/custom-home-design.component').then(m => m.CustomHomeDesignComponent),
    title: 'Custom Home Design Services - OchoWorks Designs'
  },
  {
    path: 'future-homeowners',
    loadComponent: () => import('./owner-builders/owner-builders.component').then(m => m.OwnerBuildersComponent),
    title: 'Future Homeowner House Plans - OchoWorks Designs'
  },
  {
    path: 'owner-builders',
    redirectTo: '/future-homeowners',
    pathMatch: 'full'
  },
  {
    path: 'plan-modifications',
    loadComponent: () => import('./plan-modifications/plan-modifications.component').then(m => m.PlanModificationsComponent),
    title: 'House Plan Modification Services - OchoWorks Designs'
  },
  {
    path: 'construction-ready-plan-sets',
    loadComponent: () => import('./plan-sets/plan-sets.component').then(m => m.PlanSetsComponent),
    title: 'Construction-Ready House Plan Sets - OchoWorks Designs'
  },
  {
    path: 'house-plan-styles',
    loadComponent: () => import('./plan-styles/plan-styles.component').then(m => m.PlanStylesComponent),
    title: 'House Plan Styles - OchoWorks Designs'
  },
  {
    path: 'plans',
    loadComponent: () => import('./plans/plans.component').then(m => m.PlansComponent),
    title: 'Plans - OchoWorks Designs'
  },
  {
    path: 'general-contractors-developers',
    loadComponent: () => import('./builders/builders.component').then(m => m.BuildersComponent),
    title: 'General Contractors & Developers - OchoWorks Designs'
  },
  {
    path: 'home-builders',
    redirectTo: '/general-contractors-developers',
    pathMatch: 'full'
  },

  {
    path: 'plan/:planId',
    loadComponent: () => import('./plan/plan.component').then(m => m.PlanComponent),
    title: 'Plan Details - OchoWorks Designs'
  },
  {
    path: 'contact',
    loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact Us - OchoWorks Designs'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Login - OchoWorks Designs'
  },

  // Blog Routes
  {
    path: 'blog',
    children: [
      {
        path: 'list',
        loadComponent: () => import('./blog-list/blog-list.component').then(m => m.BlogListComponent),
        title: 'Custom Home Plans & Design Insights | OchoWorks Designs',
        data: {
          description: 'Explore our blog for expert insights on custom home plans, design trends, and tips to create your dream home with OchoWorks Designs.'
        }
      },
      {
        path: 'list/:slug',
        loadComponent: () => import('./blog-detail/blog-detail.component').then(m => m.BlogDetailComponent),
        title: 'Blog Post - OchoWorks Designs',
        data: {
          description: 'Read our latest blog post for expert insights on custom home plans, design trends, and tips to create your dream home with OchoWorks Designs.'
        }
      },
      {
        /// set default blog route to redirect to /blog/list
        path: '',
        redirectTo: '/blog/list',
        pathMatch: 'full'
      }
    ]
  },

  // Admin Routes
  {
    path: 'admin',
    canActivate: [authGuard],
    children: [
      {
        path: 'blog',
        children: [
          {
            path: 'new',
            loadComponent: () => import('./blog-edit/blog-edit.component').then(m => m.BlogEditComponent),
            title: 'Create New Blog Post - Admin | OchoWorks Designs'
          },
          {
            path: 'edit/:id',
            loadComponent: () => import('./blog-edit/blog-edit.component').then(m => m.BlogEditComponent),
            title: 'Edit Blog Post - Admin | OchoWorks Designs'
          }
        ]
      },
      {
        path: 'marketing',
        children: [
          {
            path: '',
            loadComponent: () => import('./marketing-dashboard/marketing-dashboard.component')
              .then(m => m.MarketingDashboardComponent),
            title: 'Email Marketing Dashboard - Admin | OchoWorks Designs'
          },
          // Contacts routes
          {
            path: 'contacts',
            loadComponent: () => import('./marketing-contacts/marketing-contacts.component')
              .then(m => m.MarketingContactsComponent),
            title: 'Manage Marketing Contacts - Admin | OchoWorks Designs'
          },
          {
            path: 'contacts/new',
            loadComponent: () => import('./marketing-contact-edit/marketing-contact-edit.component')
              .then(m => m.MarketingContactEditComponent),
            canDeactivate: [unsavedChangesGuard],
            title: 'Add New Contact - Admin | OchoWorks Designs'
          },
          // {
          //   path: 'contacts/import',
          //   loadComponent: () => import('./marketing-contact-import/marketing-contact-import.component')
          //     .then(m => m.MarketingContactImportComponent),
          //   title: 'Import Contacts - Admin | OchoWorks Designs'
          // },
          {
            path: 'contacts/:id',
            loadComponent: () => import('./marketing-contact-edit/marketing-contact-edit.component')
              .then(m => m.MarketingContactEditComponent),
            canDeactivate: [unsavedChangesGuard],
            title: 'Edit Contact - Admin | OchoWorks Designs'
          },
          // Campaigns routes
          {
            path: 'campaigns',
            loadComponent: () => import('./marketing-campaigns/marketing-campaigns.component')
              .then(m => m.MarketingCampaignsComponent),
            title: 'Campaigns - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/new',
            loadComponent: () => import('./marketing-campaign-create/marketing-campaign-create.component')
              .then(m => m.MarketingCampaignCreateComponent),
            title: 'Create New Campaign - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/:campaignId/email-campaigns/:id',
            loadComponent: () => import('./marketing-campaign-edit/marketing-campaign-edit.component')
              .then(m => m.MarketingCampaignEditComponent),
            title: 'Edit Email Campaign - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/:campaignId/email-campaigns/:id/send',
            loadComponent: () => import('./marketing-email-campaign-send/marketing-email-campaign-send.component')
              .then(m => m.MarketingEmailCampaignSendComponent),
            title: 'Send Email Campaign - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/:campaignId/email-campaigns/new',
            loadComponent: () => import('./marketing-campaign-edit/marketing-campaign-edit.component')
              .then(m => m.MarketingCampaignEditComponent),
            title: 'Create Email Campaign - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/:campaignId/email-campaigns/:id/stats',
            loadComponent: () => import('./marketing-campaign-stats/marketing-campaign-stats.component')
              .then(m => m.MarketingCampaignStatsComponent),
            title: 'Email Campaign Statistics - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/:campaignId',
            loadComponent: () => import('./marketing-campaign-detail/marketing-campaign-detail.component')
              .then(m => m.MarketingCampaignDetailComponent),
            title: 'Campaign Details - Admin | OchoWorks Designs'
          },
          // Legacy email campaign routes kept for compatibility
          {
            path: 'campaigns/:id/send',
            loadComponent: () => import('./marketing-campaign-send/marketing-campaign-send.component')
              .then(m => m.MarketingCampaignSendComponent),
            title: 'Send Campaign - Admin | OchoWorks Designs'
          },
          {
            path: 'campaigns/:id/stats',
            loadComponent: () => import('./marketing-campaign-stats/marketing-campaign-stats.component')
              .then(m => m.MarketingCampaignStatsComponent),
            title: 'Campaign Statistics - Admin | OchoWorks Designs'
          }
        ]
      }
    ]
  },

  // Existing Plan Set Routes
  {
    path: 'plan-set',
    loadComponent: () => import('./plan-set/plan-set.component').then(m => m.PlanSetComponent),
    canActivate: [authGuard],
    title: 'Set Plan - OchoWorks Designs'
  },
  {
    path: 'plan-set/:planId',
    loadComponent: () => import('./plan-set/plan-set.component').then(m => m.PlanSetComponent),
    canActivate: [authGuard],
    title: 'Set Plan - OchoWorks Designs'
  },

  // 404 Catch-all Route (must be last)
  {
    path: '**',
    loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page Not Found - OchoWorks Designs'
  }
];
