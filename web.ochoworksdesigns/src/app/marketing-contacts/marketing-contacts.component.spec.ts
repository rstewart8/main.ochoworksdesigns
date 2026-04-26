import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingContactsComponent } from './marketing-contacts.component';

describe('MarketingContactsComponent', () => {
  let component: MarketingContactsComponent;
  let fixture: ComponentFixture<MarketingContactsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingContactsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingContactsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
