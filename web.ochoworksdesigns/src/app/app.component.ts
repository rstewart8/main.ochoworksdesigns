import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from "./header/header.component";
import { FooterComponent } from "./footer/footer.component";
import { ClickTrackingService } from './_services/click-tracking.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'web.ochoworksdesigns';
  private clickTrackingService = inject(ClickTrackingService);

  ngOnInit(): void {
    // Initialize click tracking on app startup
    this.clickTrackingService.initialize();
  }
}
