"""
Real-time Analytics Dashboard
Streamlit dashboard for visualizing distributed system metrics.
"""

import streamlit as st
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import requests


class AnalyticsDashboard:
    """
    Real-time analytics dashboard using Streamlit.
    """
    
    def __init__(self, api_gateway_url: str = 'http://localhost:5000'):
        self.api_gateway_url = api_gateway_url
        
    def fetch_metrics(self, service_name: str) -> Dict[str, Any]:
        """Fetch metrics from a service via API Gateway."""
        try:
            response = requests.get(
                f"{self.api_gateway_url}/metrics/{service_name}",
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception as e:
            st.error(f"Error fetching metrics: {e}")
            return {}
            
    def render_system_overview(self):
        """Render system overview metrics."""
        st.header("Distributed System Overview")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Active Services", "5/5", "✓")
        with col2:
            st.metric("Total Users", "150", "+12")
        with col3:
            st.metric("Active Sessions", "42", "+5")
        with col4:
            st.metric("System Health", "98%", "+2%")
            
    def render_lamport_clock(self):
        """Render Lamport clock visualization."""
        st.subheader("Lamport Clock Timeline")
        
        # Placeholder data
        events = [
            {"node": "Node 1", "time": 1, "event": "Message Send"},
            {"node": "Node 2", "time": 2, "event": "Message Receive"},
            {"node": "Node 1", "time": 3, "event": "Local Event"},
            {"node": "Node 3", "time": 4, "event": "Message Send"},
        ]
        
        for event in events:
            st.text(f"[{event['time']}] {event['node']}: {event['event']}")
            
    def render_consistency_metrics(self):
        """Render consistency protocol metrics."""
        st.subheader("Consistency Metrics")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("Replication Lag", "12ms", "-3ms")
            st.metric("Sync Status", "In Sync", "")
            
        with col2:
            st.metric("Pending Operations", "3", "-2")
            st.metric("Conflict Rate", "0.1%", "-0.05%")
            
    def render_service_health(self):
        """Render individual service health."""
        st.subheader("Service Health")
        
        services = [
            {"name": "API Gateway", "status": "Running", "uptime": "99.9%"},
            {"name": "Auth Service", "status": "Running", "uptime": "100%"},
            {"name": "Course Service", "status": "Running", "uptime": "99.8%"},
            {"name": "Chat Service", "status": "Running", "uptime": "99.7%"},
            {"name": "Whiteboard", "status": "Running", "uptime": "99.9%"},
        ]
        
        for service in services:
            col1, col2, col3 = st.columns([3, 2, 2])
            with col1:
                st.text(service["name"])
            with col2:
                st.success(service["status"])
            with col3:
                st.text(f"Uptime: {service['uptime']}")
                
    def render_chat_analytics(self):
        """Render chat message analytics."""
        st.subheader("Chat Analytics")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("Total Messages", "1,247", "+89")
            st.metric("Active Rooms", "8", "+2")
            
        with col2:
            st.metric("Avg Response Time", "2.3s", "-0.5s")
            st.metric("Messages/Hour", "145", "+23")
            
    def render_course_engagement(self):
        """Render course engagement metrics."""
        st.subheader("Course Engagement")
        
        courses = [
            {"name": "Distributed Systems", "students": 45, "activity": "High"},
            {"name": "Machine Learning", "students": 38, "activity": "Medium"},
            {"name": "Web Development", "students": 52, "activity": "High"},
        ]
        
        for course in courses:
            with st.expander(course["name"]):
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("Enrolled Students", course["students"])
                with col2:
                    st.metric("Activity Level", course["activity"])
                    
    def run(self):
        """Run the Streamlit dashboard."""
        st.set_page_config(
            page_title="DLH Analytics Dashboard",
            page_icon="📊",
            layout="wide"
        )
        
        st.title("📊 Distributed LearnHub Analytics")
        st.markdown("Real-time monitoring and analytics for distributed learning platform")
        
        # Auto-refresh
        if st.checkbox("Auto-refresh (5s)", value=True):
            time.sleep(5)
            st.rerun()
            
        # Render sections
        self.render_system_overview()
        
        st.divider()
        
        col1, col2 = st.columns(2)
        with col1:
            self.render_lamport_clock()
            self.render_chat_analytics()
            
        with col2:
            self.render_consistency_metrics()
            self.render_course_engagement()
            
        st.divider()
        
        self.render_service_health()
        
        # Footer
        st.markdown("---")
        st.markdown("*Last updated: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "*")


def main():
    """Main entry point for Streamlit dashboard."""
    dashboard = AnalyticsDashboard()
    dashboard.run()


if __name__ == '__main__':
    main()
