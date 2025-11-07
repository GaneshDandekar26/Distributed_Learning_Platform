"""
MapReduce Analytics
Distributed data processing using MapReduce paradigm with MRJob.
"""

from mrjob.job import MRJob
from mrjob.step import MRStep
import json
from typing import Iterator, Tuple


class UserActivityAnalytics(MRJob):
    """
    MapReduce job for analyzing user activity patterns.
    """
    
    def mapper(self, _, line):
        """
        Map function: Extract user activities.
        Input: JSON log line
        Output: (user_id, activity_type) pairs
        """
        try:
            log = json.loads(line)
            user_id = log.get('user_id')
            activity = log.get('activity_type')
            
            if user_id and activity:
                yield (user_id, activity), 1
        except json.JSONDecodeError:
            pass
            
    def combiner(self, key, counts):
        """
        Combiner function: Local aggregation.
        """
        yield key, sum(counts)
        
    def reducer(self, key, counts):
        """
        Reducer function: Global aggregation.
        Output: (user_id, activity_type) -> total_count
        """
        yield key, sum(counts)


class CourseEngagementAnalytics(MRJob):
    """
    MapReduce job for course engagement analysis.
    """
    
    def steps(self):
        return [
            MRStep(mapper=self.mapper_get_engagement,
                   combiner=self.combiner_sum,
                   reducer=self.reducer_sum),
            MRStep(reducer=self.reducer_sort)
        ]
        
    def mapper_get_engagement(self, _, line):
        """Extract course engagement metrics."""
        try:
            log = json.loads(line)
            course_id = log.get('course_id')
            event_type = log.get('event_type')
            duration = log.get('duration', 0)
            
            if course_id and event_type:
                yield f"{course_id}_{event_type}", duration
        except json.JSONDecodeError:
            pass
            
    def combiner_sum(self, key, values):
        """Local sum of durations."""
        yield key, sum(values)
        
    def reducer_sum(self, key, values):
        """Global sum of durations."""
        total = sum(values)
        course_id = key.split('_')[0]
        yield course_id, total
        
    def reducer_sort(self, course_id, totals):
        """Sort courses by total engagement."""
        total = sum(totals)
        yield None, (total, course_id)


class ChatMessageAnalytics(MRJob):
    """
    MapReduce job for chat message analysis.
    """
    
    def mapper(self, _, line):
        """
        Extract chat metrics.
        """
        try:
            msg = json.loads(line)
            room_id = msg.get('room_id')
            user_id = msg.get('user_id')
            word_count = len(msg.get('content', '').split())
            
            if room_id and user_id:
                # Emit multiple metrics
                yield ('room', room_id), 1  # Message count per room
                yield ('user', user_id), 1  # Message count per user
                yield ('room_words', room_id), word_count  # Words per room
        except json.JSONDecodeError:
            pass
            
    def combiner(self, key, counts):
        """Combine local counts."""
        yield key, sum(counts)
        
    def reducer(self, key, counts):
        """Aggregate final counts."""
        yield key, sum(counts)


class AnalyticsProcessor:
    """
    Wrapper for running MapReduce analytics jobs.
    """
    
    def __init__(self):
        self.jobs = {
            'user_activity': UserActivityAnalytics,
            'course_engagement': CourseEngagementAnalytics,
            'chat_analysis': ChatMessageAnalytics
        }
        
    def run_job(self, job_name: str, input_path: str, output_path: str = None):
        """
        Run a specific analytics job.
        
        Args:
            job_name: Name of the job to run
            input_path: Path to input data
            output_path: Path for output (optional)
        """
        if job_name not in self.jobs:
            raise ValueError(f"Unknown job: {job_name}")
            
        job_class = self.jobs[job_name]
        
        # Configure job arguments
        args = ['-r', 'local', input_path]
        if output_path:
            args.extend(['--output-dir', output_path])
            
        # Run the job
        job = job_class(args=args)
        with job.make_runner() as runner:
            runner.run()
            
            # Collect results
            results = []
            for key, value in job.parse_output(runner.cat_output()):
                results.append((key, value))
                
            return results
            
    def analyze_user_activity(self, log_file: str):
        """Analyze user activity patterns."""
        return self.run_job('user_activity', log_file)
        
    def analyze_course_engagement(self, log_file: str):
        """Analyze course engagement."""
        return self.run_job('course_engagement', log_file)
        
    def analyze_chat_messages(self, log_file: str):
        """Analyze chat messages."""
        return self.run_job('chat_analysis', log_file)


if __name__ == '__main__':
    # Run as standalone MRJob
    UserActivityAnalytics.run()
