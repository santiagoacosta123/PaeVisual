import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-dashboard-supervisor',
  styleUrl: './dashboard-supervisor.css',
  templateUrl: './dashboard-supervisor.html',
})
export class DashboardSupervisor {}
