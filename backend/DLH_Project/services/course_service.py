"""
Course Management Service
Handles course creation, enrollment, and content management.
"""

import socket
import threading
import json
import pickle
from typing import Dict, List, Any
from xmlrpc.server import SimpleXMLRPCServer


class CourseService:
    """
    Distributed service for managing courses and enrollments.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5002):
        self.host = host
        self.port = port
        self.courses = {}  # Course database
        self.enrollments = {}  # User enrollments
        self.server = None
        
    def create_course(self, course_id: str, course_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new course."""
        if course_id in self.courses:
            return {'success': False, 'error': 'Course already exists'}
        
        self.courses[course_id] = {
            'id': course_id,
            'title': course_data.get('title', ''),
            'description': course_data.get('description', ''),
            'instructor': course_data.get('instructor', ''),
            'students': [],
            'content': []
        }
        
        return {'success': True, 'message': 'Course created successfully'}
        
    def get_course(self, course_id: str) -> Dict[str, Any]:
        """Retrieve course information."""
        if course_id not in self.courses:
            return {'success': False, 'error': 'Course not found'}
        
        return {'success': True, 'course': self.courses[course_id]}
        
    def list_courses(self) -> Dict[str, Any]:
        """List all available courses."""
        return {
            'success': True,
            'courses': list(self.courses.values())
        }
        
    def enroll_student(self, course_id: str, student_id: str) -> Dict[str, Any]:
        """Enroll a student in a course."""
        if course_id not in self.courses:
            return {'success': False, 'error': 'Course not found'}
        
        if student_id not in self.courses[course_id]['students']:
            self.courses[course_id]['students'].append(student_id)
            
        if student_id not in self.enrollments:
            self.enrollments[student_id] = []
        self.enrollments[student_id].append(course_id)
        
        return {'success': True, 'message': 'Enrolled successfully'}
        
    def get_student_courses(self, student_id: str) -> Dict[str, Any]:
        """Get all courses a student is enrolled in."""
        courses = self.enrollments.get(student_id, [])
        course_list = [self.courses[cid] for cid in courses if cid in self.courses]
        
        return {'success': True, 'courses': course_list}
        
    def start(self):
        """Start the course service."""
        self.server = SimpleXMLRPCServer((self.host, self.port), allow_none=True)
        self.server.register_instance(self)
        
        print(f"Course Service started on {self.host}:{self.port}")
        self.server.serve_forever()
        
    def stop(self):
        """Stop the course service."""
        if self.server:
            self.server.shutdown()


if __name__ == '__main__':
    course_service = CourseService()
    course_service.start()
