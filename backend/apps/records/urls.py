from django.urls import path

from .views import CreateRecordView, DeleteRecordView, DownloadRecordView, MyRecordsView


urlpatterns = [
    path("mine", MyRecordsView.as_view(), name="records-mine"),
    path("", CreateRecordView.as_view(), name="records-create"),
    path("<int:record_id>/download", DownloadRecordView.as_view(), name="record-download"),
    path("<int:record_id>", DeleteRecordView.as_view(), name="record-delete"),
]
